// Monkey-patch HTMLCanvasElement.getContext early to set willReadFrequently
// for 2D contexts unless the option is explicitly provided. This helps
// performance for repeated getImageData readbacks and removes browser
// console suggestions.
if (typeof HTMLCanvasElement !== 'undefined' && HTMLCanvasElement.prototype.getContext) {
  const _origGetContext = HTMLCanvasElement.prototype.getContext
  HTMLCanvasElement.prototype.getContext = function (type, options) {
    try {
      if (type === '2d') {
        if (!options || typeof options !== 'object') options = {}
        if (!options.willReadFrequently) options.willReadFrequently = true
      }
    } catch (e) {
      // ignore
    }
    return _origGetContext.call(this, type, options)
  }
}

import React from 'react'
import ReactDOM from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from 'react-router-dom'
import App from './App.jsx'
import Register from './pages/Register.jsx'
import Detect from './pages/Detect.jsx'
import './index.css'

const router = createBrowserRouter([
  { path: '/', element: <App /> },
  { path: '/register', element: <Register /> },
  { path: '/detect', element: <Detect /> },
])

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
)
