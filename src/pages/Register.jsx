import { useEffect, useRef, useState } from 'react';
import * as faceapi from 'face-api.js';

export default function Register() {
  const [modelsLoaded, setModelsLoaded] = useState(false);
  const [studentData, setStudentData] = useState({
    student_id: '',
    first_name: '',
    last_name: '',
    middle_name: '',
    course: '',
    year_level: '',
    section: '',
    email: ''
  });
  const [status, setStatus] = useState('Load camera and take a snapshot');
  const [photo, setPhoto] = useState(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);

  useEffect(() => {
    const loadModels = async () => {
      const MODEL_URL = import.meta.env.BASE_URL + '/models';
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromUri(MODEL_URL),
        faceapi.nets.faceLandmark68Net.loadFromUri(MODEL_URL),
        faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL)
      ]);
      setModelsLoaded(true);
    };
    loadModels();
  }, []);

  const openCamera = async () => {
    const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
    const video = videoRef.current;
    video.srcObject = stream;
    await video.play();
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setStudentData(prev => ({
      ...prev,
      [name]: value
    }));
  };
const takeSnapshotAndRegister = async () => {
  setStatus('Processing...');
  
  try {
    // Validate required fields
    if (!studentData.student_id || !studentData.first_name || !studentData.last_name) {
      setStatus('Student ID, First Name, and Last Name are required');
      return;
    }

    // Validate student ID format
    if (!/^[A-Za-z0-9-]+$/.test(studentData.student_id)) {
      setStatus('Student ID should only contain letters, numbers, and hyphens');
      return;
    }

    // Check if video is ready
    if (!videoRef.current || !videoRef.current.srcObject) {
      setStatus('Please open the camera first');
      return;
    }

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // Get face descriptor with proper error handling
    setStatus('Detecting face...');
    
    const detection = await faceapi
      .detectSingleFace(canvas)
      .withFaceLandmarks()
      .withFaceDescriptor();

    if (!detection) {
      setStatus('No face detected. Please try again with clear lighting.');
      return;
    }

    // Convert Float32Array to regular array
    const face_encoding = Array.from(detection.descriptor);

    // Validate face encoding
    if (!face_encoding || face_encoding.length === 0) {
      setStatus('Face encoding failed. Please try again.');
      return;
    }
    console.log('Face encoding length:', face_encoding.length);
    console.log('First few values:', face_encoding.slice(0, 5));
     const requestData = {
      ...studentData,
      face_encoding: face_encoding
    };
    
    console.log('Sending request data:', {
      student_id: requestData.student_id,
      first_name: requestData.first_name,
      last_name: requestData.last_name,
      face_encoding_length: requestData.face_encoding.length,
      has_middle_name: !!requestData.middle_name,
      has_course: !!requestData.course
    });

    setStatus('Registering student...');
    
   const registerRes = await fetch('http://localhost:4000/api/register', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestData)
    });

    console.log('Response status:', registerRes.status);
    console.log('Response ok:', registerRes.ok);

    const responseText = await registerRes.text();
    console.log('Raw response:', responseText);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
    } catch (parseError) {
      console.error('Failed to parse response as JSON:', parseError);
      throw new Error(`Server returned invalid JSON: ${responseText}`);
    }

    if (!registerRes.ok) {
      console.error('Registration failed with response:', responseData);
      throw new Error(responseData.error || `Registration failed with status ${registerRes.status}`);
    }

    console.log('Registration successful:', responseData);
    setStatus('Uploading photo...');

    // Upload photo
    const blob = await new Promise(resolve => {
      canvas.toBlob(resolve, 'image/jpeg', 0.9);
    });

    const formData = new FormData();
    formData.append('photo', blob, `${studentData.student_id}-photo.jpg`);
    formData.append('student_id', studentData.student_id);

    const uploadRes = await fetch('http://localhost:4000/api/upload-photo', {
      method: 'POST',
      body: formData
    });

    const uploadData = await uploadRes.json();
    
    if (!uploadRes.ok) {
      console.error('Photo upload failed:', uploadData);
      throw new Error('Photo upload failed: ' + (uploadData.error || 'Unknown error'));
    }

    console.log('Photo upload successful:', uploadData);
    setStatus('Student registered successfully!');
    
    // Clear the form
    setStudentData({
      student_id: '',
      first_name: '',
      last_name: '',
      middle_name: '',
      course: '',
      year_level: '',
      section: '',
      email: ''
    });

    // Stop the camera
    const stream = video.srcObject;
    const tracks = stream.getTracks();
    tracks.forEach(track => track.stop());
    video.srcObject = null;

  } catch (error) {
    console.error('Registration error:', error);
    setStatus(error.message || 'Registration failed. Please try again.');
  }
};

  return (
    <div className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="bg-white rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-extrabold text-gray-900 mb-2">Register Face</h1>
            <p className="text-lg text-gray-600">Add a new face to the recognition system</p>
          </div>

          <div className="space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Student ID *</label>
                <input 
                  name="student_id"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.student_id} 
                  onChange={handleInputChange} 
                  placeholder="Enter student ID" 
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">First Name *</label>
                <input 
                  name="first_name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.first_name} 
                  onChange={handleInputChange} 
                  placeholder="Enter first name" 
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Last Name *</label>
                <input 
                  name="last_name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.last_name} 
                  onChange={handleInputChange} 
                  placeholder="Enter last name" 
                  required
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Middle Name</label>
                <input 
                  name="middle_name"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.middle_name} 
                  onChange={handleInputChange} 
                  placeholder="Enter middle name" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Course</label>
                <input 
                  name="course"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.course} 
                  onChange={handleInputChange} 
                  placeholder="Enter course" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Year Level</label>
                <select 
                  name="year_level"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.year_level} 
                  onChange={handleInputChange}
                >
                  <option value="">Select Year Level</option>
                  <option value="1st">1st Year</option>
                  <option value="2nd">2nd Year</option>
                  <option value="3rd">3rd Year</option>
                  <option value="4th">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Section</label>
                <input 
                  name="section"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.section} 
                  onChange={handleInputChange} 
                  placeholder="Enter section" 
                />
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-2">Email</label>
                <input 
                  name="email"
                  type="email"
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-colors" 
                  value={studentData.email} 
                  onChange={handleInputChange} 
                  placeholder="Enter email" 
                />
              </div>
            </div>

            <div className="bg-gray-50 rounded-xl p-6">
              <div className="flex flex-col sm:flex-row gap-4 items-center mb-6">
                <div className="flex gap-3 w-full sm:w-auto">
                  <button 
                    disabled={!modelsLoaded} 
                    className="flex-1 sm:flex-none px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-blue-600" 
                    onClick={openCamera}
                  >
                    Open Camera
                  </button>
                  <button 
                    disabled={!modelsLoaded} 
                    className="flex-1 sm:flex-none px-6 py-3 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors disabled:opacity-50 disabled:hover:bg-green-600" 
                    onClick={takeSnapshotAndRegister}
                  >
                    Capture & Register
                  </button>
                </div>
              </div>
              
              <div className="text-sm font-medium text-center mb-4 p-2 rounded-lg bg-blue-50 text-blue-700">
                {status}
              </div>

              <div className="relative rounded-lg overflow-hidden shadow-md">
                <video ref={videoRef} className="w-full h-full object-cover" />
                <canvas ref={canvasRef} className="absolute inset-0" />
              </div>
            </div>

            <div className="text-center">
              <a 
                className="inline-flex items-center text-blue-600 hover:text-blue-800 font-medium transition-colors" 
                href="/detect"
              >
                <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 19l-7-7 7-7" />
                </svg>
                Go to Detection Page
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
