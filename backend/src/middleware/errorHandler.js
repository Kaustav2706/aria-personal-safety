// Express global error handler middleware
export const errorHandler = (err, req, res, next) => {
  console.error('🔴 [GLOBAL ERROR HANDLER]:', err);

  const statusCode = err.statusCode || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(statusCode).json({
    success: false,
    message: message,
    error: process.env.NODE_ENV === 'development' ? err.stack : undefined
  });
};

export default errorHandler;
