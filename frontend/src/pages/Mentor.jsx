import React from 'react';
import { Navigate } from 'react-router-dom';

// Mentor page removed. Redirect users to Study Hub.
function Mentor() {
  return <Navigate to="/studyhub" replace />;
}

export default Mentor;