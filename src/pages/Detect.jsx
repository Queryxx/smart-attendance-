"use client"

import { useEffect, useRef, useState } from "react"
import * as faceapi from "face-api.js"
import { API_BASE } from "../components/config.js"

export default function Detect() {
  const [modelsLoaded, setModelsLoaded] = useState(false)
  const [status, setStatus] = useState("Open camera to start detection")
  const [currentStudent, setCurrentStudent] = useState(null)
  const [error, setError] = useState(null)
  const [attendanceType, setAttendanceType] = useState('in') // 'in' or 'out'
  const videoRef = useRef(null)
  const overlayRef = useRef(null)
  const [boxes, setBoxes] = useState([]) // boxes to render as DOM overlays
  const streamRef = useRef(null)
  const [lastAttendanceCheck, setLastAttendanceCheck] = useState({})  // Track last attendance time for each student

  useEffect(() => {
    const loadModels = async () => {
      try {
        const MODEL_URL = `${import.meta.env.BASE_URL}models`
        console.log('Loading models from:', MODEL_URL)
        await Promise.all([
          faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
          faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
          faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL),
        ])
        
        const modelLoaded = faceapi.nets.ssdMobilenetv1.isLoaded && 
                          faceapi.nets.faceLandmark68Net.isLoaded && 
                          faceapi.nets.faceRecognitionNet.isLoaded
        
        if (!modelLoaded) {
          throw new Error('Models did not load correctly')
        }
        console.log('✅ All models loaded successfully')
        setModelsLoaded(true)
      } catch (error) {
        console.error('Failed to load models:', error)
        setStatus('Error loading models. Please refresh and try again.')
      }
    }
    loadModels()

    // Cleanup function
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop())
      }
    }
  }, [])

  const openCamera = async () => {
    try {
      console.log('Requesting camera access...')
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { min: 640, ideal: 1280, max: 1920 },
          height: { min: 480, ideal: 720, max: 1080 },
          facingMode: 'user'
        }
      })
      
      streamRef.current = stream
      const video = videoRef.current
      if (!video) {
        throw new Error('Video element not found')
      }
      
      video.srcObject = stream
      video.setAttribute('playsinline', 'true')
      
      // Wait for video to load metadata
      await new Promise((resolve) => {
        video.onloadedmetadata = () => {
          resolve()
        }
      })
      
      console.log('Camera stream acquired, playing video...')
      await video.play()
      console.log('Video playing, starting detection...')
      startDetection()
    } catch (error) {
      console.error('Camera access error:', error)
      setError('Failed to access camera. Please ensure camera permissions are granted.')
      setStatus('Camera error - check permissions')
    }
  }

  const startDetection = async () => {
    try {
      setStatus("Loading student data...")
      const res = await fetch(`${API_BASE}/api/students`)
      if (!res.ok) {
        throw new Error(`Failed to fetch students: ${res.status} ${res.statusText}`)
      }
      const data = await res.json()
      const students = data.students || []
      console.log(`Loaded ${students.length} students from server`)

      // Build labeled descriptors
      const labeled = students.map(student => {
        const descriptor = new Float32Array(student.face_encoding)
        // Ensure label is string to match FaceMatcher expectations
        return new faceapi.LabeledFaceDescriptors(String(student.student_id), [descriptor])
      })
      const matcher = new faceapi.FaceMatcher(labeled, 0.6)

      setStatus("Detecting...")

      const video = videoRef.current
      const overlay = overlayRef.current
      if (!video || !overlay) {
        throw new Error('Video or overlay element not found')
      }
      
      let detectionActive = true
      let frameCount = 0


      const detectFaces = async () => {
        if (!detectionActive) return
        try {
          frameCount++
          // Wait for video to be ready
          if (video.readyState < 2) {
            requestAnimationFrame(detectFaces)
            return
          }
          // Get video intrinsic dimensions
          const videoWidth = video.videoWidth
          const videoHeight = video.videoHeight
          if (videoWidth > 0 && videoHeight > 0) {
            // Get the displayed size of the video element (may be scaled by CSS)
            const rect = video.getBoundingClientRect()
            const displayWidth = rect.width
            const displayHeight = rect.height

            // Detect faces
            const detections = await faceapi
              .detectAllFaces(video, new faceapi.SsdMobilenetv1Options({ minConfidence: 0.3 }))
              .withFaceLandmarks()
              .withFaceDescriptors()

            if (frameCount % 30 === 0) {
              console.log('Faces detected:', detections.length)
            }

            // Compute scaling factors from intrinsic video to displayed size
            const scaleX = displayWidth / videoWidth
            const scaleY = displayHeight / videoHeight

            // Map detections to overlay boxes and handle attendance
            const newBoxes = detections.map(d => {
              const b = d.detection.box
              const best = matcher.findBestMatch(d.descriptor)
              const student = students.find(s => String(s.student_id) === best.label)
              
              // Only process if we found a matching student and confidence is high
              if (student && best.distance < 0.6) {
                const now = Date.now()
                const lastCheck = lastAttendanceCheck[student.student_id] || 0
                
                // Only process attendance every 5 seconds per student
                if (now - lastCheck >= 5000) {
                  setLastAttendanceCheck(prev => ({
                    ...prev,
                    [student.student_id]: now
                  }))
                  
                  // Record attendance
                  fetch(`${API_BASE}/api/attendance`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      student_id: student.student_id,
                      type: attendanceType
                    })
                  }).then(res => {
                    if (!res.ok) {
                      console.error('Failed to record attendance');
                    }
                  }).catch(err => {
                    console.error('Attendance recording error:', err);
                  });
                }
                
                return {
                  x: b.x * scaleX,
                  y: b.y * scaleY,
                  width: b.width * scaleX,
                  height: b.height * scaleY,
                  student: student,
                  distance: best.distance
                }
              }
              
              return {
                x: b.x * scaleX,
                y: b.y * scaleY,
                width: b.width * scaleX,
                height: b.height * scaleY,
                student: null,
                distance: best.distance
              }
            })

            setBoxes(newBoxes)
            // Update currentStudent if any known face
            const known = newBoxes.find(b => b.student)
            setCurrentStudent(known ? known.student : null)
          }
          // Continue detection loop
          if (detectionActive) {
            requestAnimationFrame(detectFaces)
          }
        } catch (error) {
          console.error('Detection frame error:', error)
          // Continue detection even if one frame fails
          if (detectionActive) {
            requestAnimationFrame(detectFaces)
          }
        }
      }

      // Start detection loop
      detectFaces()

      // Cleanup function
      return () => {
        detectionActive = false
      }

    } catch (error) {
      console.error('startDetection error:', error)
      setError('Failed to start detection. Please refresh and try again.')
      setStatus('Detection error - please refresh')
    }
  }

  const stopCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop())
      streamRef.current = null
    }
    setCurrentStudent(null)
    setBoxes([])
    setStatus("Camera stopped - click Open Camera to start again")
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-50 py-12">
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl overflow-hidden">
          <div className="p-8">
            <div className="text-center mb-8">
              <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Face Detection</h1>
              <p className="text-lg text-gray-600">Real-time face recognition system</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-6 mb-6">
              <div className="flex flex-col sm:flex-row items-center gap-4 mb-4">
                <div className="flex gap-2">
                  <button
                    disabled={!modelsLoaded}
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-blue-600 shadow-md hover:shadow-lg"
                    onClick={openCamera}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z"
                      />
                    </svg>
                    Open Camera
                  </button>
                  <button
                    className="flex items-center justify-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg transition-colors shadow-md hover:shadow-lg"
                    onClick={stopCamera}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M9 10a1 1 0 011-1h4a1 1 0 011 1v4a1 1 0 01-1 1h-4a1 1 0 01-1-1v-4z"
                      />
                    </svg>
                    Stop Camera
                  </button>
                </div>
                <div className="flex-1 text-center sm:text-left">
                  <div className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-50 text-blue-700">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        d="M13 10V3L4 14h7v7l9-11h-7z"
                      />
                    </svg>
                    {status}
                  </div>
                </div>
              </div>

              {error && (
                <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                  <div className="flex items-center text-red-700">
                    <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    {error}
                  </div>
                </div>
              )}

              <div className="relative rounded-lg overflow-hidden shadow-lg bg-black flex justify-center">
                <video 
                  ref={videoRef} 
                  className="max-w-full h-auto"
                  style={{ display: 'block', objectFit: 'contain', maxHeight: '70vh', zIndex: 10 }}
                  muted
                  playsInline
                />
                <div
                  ref={overlayRef}
                  className="absolute top-0 left-0 w-full h-full pointer-events-none"
                  style={{ maxHeight: '70vh', zIndex: 9999 }}
                >
                  {boxes.map((b, i) => {
                    const labelText = b.student ? `Hello, ${b.student.first_name}` : ''
                    // We'll position the label above the box by default. If there's not enough space
                    // above, place it below. Also clamp horizontal position so it doesn't overflow overlay.
                    const overlayWidth = overlayRef.current ? overlayRef.current.clientWidth : 0
                    const overlayHeight = overlayRef.current ? overlayRef.current.clientHeight : 0

                    // Estimated label size (we'll assume 10px per character + padding) as a lightweight measurement
                    const estLabelPadding = 16 // left+right padding
                    const estLabelHeight = 28
                    const estCharWidth = 8
                    const estLabelWidth = labelText ? Math.min(overlayWidth, labelText.length * estCharWidth + estLabelPadding) : 0

                    // Prefer above
                    let labelLeft = b.x
                    // Center label on box if possible
                    labelLeft = b.x + (b.width - estLabelWidth) / 2
                    // clamp
                    labelLeft = Math.max(4, Math.min(labelLeft, Math.max(4, overlayWidth - estLabelWidth - 4)))

                    let labelTop = b.y - estLabelHeight - 6 // 6px gap
                    let placeBelow = false
                    if (labelTop < 0) {
                      // not enough space above - place below the box
                      labelTop = b.y + b.height + 6
                      placeBelow = true
                    }
                    // ensure label doesn't go beyond overlay height
                    if (labelTop + estLabelHeight > overlayHeight) {
                      labelTop = Math.max(4, overlayHeight - estLabelHeight - 4)
                    }

                    return (
                      <div key={i} className="absolute" style={{ left: `${b.x}px`, top: `${b.y}px`, width: `${b.width}px`, height: `${b.height}px`, pointerEvents: 'none' }}>
                        <div
                          className="absolute border-2 rounded-lg"
                          style={{
                            left: 0,
                            top: 0,
                            width: '100%',
                            height: '100%',
                            boxSizing: 'border-box',
                            borderColor: b.student ? '#22c55e' : '#ef4444',
                            zIndex: 9999,
                            pointerEvents: 'none'
                          }}
                        />

                        {labelText && (
                          <div
                            aria-hidden
                            style={{
                              position: 'absolute',
                              left: `${labelLeft - b.x}px`, // position relative to box container
                              top: `${labelTop - b.y}px`,
                              background: 'rgba(34,197,94,0.92)',
                              color: '#fff',
                              padding: '4px 8px',
                              fontWeight: 700,
                              borderRadius: 6,
                              whiteSpace: 'nowrap',
                              transform: 'translateZ(0)',
                              boxShadow: '0 2px 6px rgba(0,0,0,0.2)'
                            }}
                          >
                            {labelText}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>

            <div className="space-y-6">
              <div className="flex justify-center gap-4">
                <button
                  onClick={() => setAttendanceType('in')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    attendanceType === 'in'
                      ? 'bg-green-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Time In
                </button>
                <button
                  onClick={() => setAttendanceType('out')}
                  className={`px-6 py-3 rounded-lg font-medium transition-colors ${
                    attendanceType === 'out'
                      ? 'bg-blue-600 text-white'
                      : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  Time Out
                </button>
              </div>

              {currentStudent && (
                <div className="bg-green-50 rounded-xl p-6 animate-fade-in">
                  <div className="flex items-center justify-between mb-4">
                    <div className="flex items-center">
                      <svg className="w-8 h-8 text-green-600 mr-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7" />
                      </svg>
                      <h3 className="text-xl font-bold text-gray-900">Student Detected</h3>
                    </div>
                    <span className="px-3 py-1 text-sm font-medium text-green-700 bg-green-100 rounded-full">
                      {attendanceType === 'in' ? 'Time In' : 'Time Out'}
                    </span>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-500">Student ID</p>
                      <p className="font-medium text-gray-900">{currentStudent.student_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Name</p>
                      <p className="font-medium text-gray-900">
                        {currentStudent.first_name} {currentStudent.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Course</p>
                      <p className="font-medium text-gray-900">{currentStudent.course || 'N/A'}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Section</p>
                      <p className="font-medium text-gray-900">
                        {currentStudent.year_level} - {currentStudent.section || 'N/A'}
                      </p>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-center">
                <a
                  className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors"
                  href="/register"
                >
                  <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                  </svg>
                  Register New Student
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}