/**
 * Generate a random readable password
 * Uses characters that are easy to distinguish (no 0/O, 1/l/I confusion)
 * @returns {string} A 10-character password
 */
const generateReadablePassword = () => {
  const chars = 'abcdefghjkmnpqrstuvwxyzABCDEFGHJKMNPQRSTUVWXYZ23456789';
  let password = '';
  for (let i = 0; i < 10; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
};

module.exports = {
  generateReadablePassword
};
