const path = require('path');
const fs = require('fs');

// Mock fs.existsSync and mkdirSync to avoid creating real directories
jest.mock('fs', () => ({
  existsSync: jest.fn().mockReturnValue(true),
  mkdirSync: jest.fn(),
}));

const { createAttachmentUpload } = require('../middleware/uploadFactory');

describe('createAttachmentUpload', () => {
  it('returns an Express middleware function', () => {
    const middleware = createAttachmentUpload({ destination: 'uploads/test' });
    expect(typeof middleware).toBe('function');
    // Express middleware has 3 params: req, res, next
    expect(middleware.length).toBe(3);
  });

  it('accepts a custom destination', () => {
    // Should not throw
    const middleware = createAttachmentUpload({ destination: 'uploads/custom' });
    expect(middleware).toBeDefined();
  });

  it('accepts a custom filePrefix', () => {
    const middleware = createAttachmentUpload({
      destination: 'uploads/test',
      filePrefix: 'maint-',
    });
    expect(middleware).toBeDefined();
  });

  it('accepts custom maxFiles', () => {
    const middleware = createAttachmentUpload({
      destination: 'uploads/test',
      maxFiles: 5,
    });
    expect(middleware).toBeDefined();
  });

  describe('blocked extensions', () => {
    let fileFilter;

    beforeEach(() => {
      // Extract the file filter by spying on multer internals
      // We need to test the filter logic directly
      const { _getFileFilter } = require('../middleware/uploadFactory');
      if (_getFileFilter) {
        fileFilter = _getFileFilter();
      }
    });

    // Test via the BLOCKED_EXTENSIONS export
    it('exports BLOCKED_EXTENSIONS regex', () => {
      const { BLOCKED_EXTENSIONS } = require('../middleware/uploadFactory');
      expect(BLOCKED_EXTENSIONS).toBeInstanceOf(RegExp);
      // Should block dangerous files
      expect(BLOCKED_EXTENSIONS.test('malware.exe')).toBe(true);
      expect(BLOCKED_EXTENSIONS.test('script.php')).toBe(true);
      expect(BLOCKED_EXTENSIONS.test('hack.ps1')).toBe(true);
      expect(BLOCKED_EXTENSIONS.test('virus.bat')).toBe(true);
      expect(BLOCKED_EXTENSIONS.test('trojan.vbs')).toBe(true);
      // Should not block safe files
      expect(BLOCKED_EXTENSIONS.test('document.pdf')).toBe(false);
      expect(BLOCKED_EXTENSIONS.test('photo.jpg')).toBe(false);
      expect(BLOCKED_EXTENSIONS.test('report.xlsx')).toBe(false);
    });
  });

  describe('ATTACHMENT_MIME_TYPES', () => {
    it('includes image types', () => {
      const { ATTACHMENT_MIME_TYPES } = require('../middleware/uploadFactory');
      expect(ATTACHMENT_MIME_TYPES).toContain('image/jpeg');
      expect(ATTACHMENT_MIME_TYPES).toContain('image/png');
      expect(ATTACHMENT_MIME_TYPES).toContain('image/gif');
      expect(ATTACHMENT_MIME_TYPES).toContain('image/webp');
    });

    it('includes document types', () => {
      const { ATTACHMENT_MIME_TYPES } = require('../middleware/uploadFactory');
      expect(ATTACHMENT_MIME_TYPES).toContain('application/pdf');
      expect(ATTACHMENT_MIME_TYPES).toContain('application/msword');
      expect(ATTACHMENT_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.wordprocessingml.document');
      expect(ATTACHMENT_MIME_TYPES).toContain('application/vnd.ms-excel');
      expect(ATTACHMENT_MIME_TYPES).toContain('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    });
  });
});
