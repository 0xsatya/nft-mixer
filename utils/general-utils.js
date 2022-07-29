function logMessage(message, seperator, repeatNewLine) {
  const newLine = `\n`;
  console.log(`${newLine.repeat(repeatNewLine)} ${seperator.repeat(20)} ${newLine} ${message} ${newLine}`);
}

module.exports = { logMessage };
