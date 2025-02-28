function sendError(errors) {
  let message = "";
  if (typeof errors === "object") {
    let error = Object.entries(errors)[0];
    message = `${error[0]} ${error[1]}`;
  }
  if (typeof errors === "string") {
    message = errors;
  }
  return { error: true, message, status: false };
}

module.exports = { sendError };
