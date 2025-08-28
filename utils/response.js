export function errorResponse(res, message, error = null, code = 500) {
  return res.status(code).json({
    success: false,
    message,
    error,
  });
}

export function successResponse(res, message, data = null, code = 200) {
  return res.status(code).json({
    success: true,
    message,
    data,
  });
}
