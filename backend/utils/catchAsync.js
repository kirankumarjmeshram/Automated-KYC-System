/**
  * Wraps asynchronous controller/service functions to catch rejected promises 
  * and pass errors directly to Express global error handling middleware.
  */
const catchAsync = (fn) => {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
};

module.exports = catchAsync;
