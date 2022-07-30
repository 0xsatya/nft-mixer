function logMessage(message, seperator, repeatNewLine) {
  const newLine = `\n`;
  const _msg = message || '';
  const _seperator = seperator || '';
  const _repNwLine = repeatNewLine || 0;
  console.log(`${newLine.repeat(_repNwLine)} ${_seperator.repeat(20)} ${newLine} ${_msg} ${newLine}`);
}

module.exports = { logMessage };
