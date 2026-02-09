# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.1] - 2026-02-01

### Security
- **CRITICAL:** Updated body-parser from 1.20.2 to 2.2.2 to fix CVE-2024-45590
  - Fixes denial of service vulnerability in request parsing
  - No breaking changes to API functionality
  - All request parsing continues to work as expected
- Updated Express from 4.19.2 to 4.22.1 for additional security patches
  - Includes body-parser 1.20.4 (also patched for CVE-2024-45590)
  - No breaking changes to middleware or routing

### Dependencies
- body-parser@2.2.2 (was 1.20.2)
- express@4.22.1 (was 4.19.2)

### Testing
- ✅ All authentication endpoints verified
- ✅ All CRUD operations tested
- ✅ Request parsing working correctly
- ✅ Error handling unchanged
- ✅ Logging and monitoring unaffected

---

## [2.0.0] - 2025-XX-XX

### Added
- Voice-to-review feature for mobile app
- OpenAI integration for speech-to-text transcription
- Enhanced review creation with audio support

### Fixed
- Map marker color calculation
- List events pagination (parseInt for page/pageLimit)
- User model import in create-review endpoint
- Status filter for active/inactive mapathons

### Changed
- MongoDB connection string updated
- Environment variable management improved

---

## [1.0.0] - Initial Release

- Basic API functionality
- User authentication
- Venue reviews
- Events/Mapathons
- Teams management
