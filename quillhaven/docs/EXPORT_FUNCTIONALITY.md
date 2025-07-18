# Export Functionality Documentation

## Overview

The export functionality allows users to export their writing projects in multiple formats (DOCX, PDF, TXT, EPUB) with support for chapter selection, metadata injection, and secure download links.

## Architecture

### Components

1. **ExportService** - Main service handling export logic
2. **QueueService** - Background job processing for exports
3. **CleanupService** - Periodic cleanup of expired exports
4. **API Endpoints** - REST endpoints for export operations

### Security Features

- **Secure Libraries**: Uses Puppeteer for PDF generation and nodepub for EPUB (replacing vulnerable epub-gen)
- **Job Queuing**: Database-based queue system instead of Redis-dependent Bull
- **Secure Downloads**: Time-limited download links with tokens
- **Access Control**: User ownership validation for all operations

## API Endpoints

### Create Export
```
POST /api/projects/{id}/export
```

**Request Body:**
```json
{
  "format": "DOCX|PDF|TXT|EPUB",
  "chapterIds": ["chapter-1", "chapter-2"], // optional
  "includeMetadata": true,
  "metadata": {
    "title": "Custom Title",
    "author": "Author Name",
    "description": "Book description",
    "genre": "Fiction",
    "language": "en",
    "publishDate": "2025-01-01",
    "version": "1.0"
  }
}
```

**Response:**
```json
{
  "success": true,
  "exportId": "export-123"
}
```

### Get Export Status
```
GET /api/exports/{id}
```

**Response:**
```json
{
  "id": "export-123",
  "projectId": "project-123",
  "format": "DOCX",
  "status": "COMPLETED",
  "filename": "My_Novel_2025-01-01.docx",
  "fileSize": 1024000,
  "downloadUrl": "/api/exports/export-123/download?token=abc123&expires=1234567890",
  "expiresAt": "2025-01-02T00:00:00Z",
  "createdAt": "2025-01-01T12:00:00Z",
  "updatedAt": "2025-01-01T12:05:00Z"
}
```

### Download Export
```
GET /api/exports/{id}/download?token={token}&expires={timestamp}
```

Returns the file with appropriate content-type headers.

### Get Export History
```
GET /api/exports?limit=10
```

**Response:**
```json
{
  "exports": [
    {
      "id": "export-123",
      "projectId": "project-123",
      "format": "DOCX",
      "status": "COMPLETED",
      "filename": "My_Novel_2025-01-01.docx",
      "createdAt": "2025-01-01T12:00:00Z"
    }
  ]
}
```

## Export Formats

### DOCX
- Uses `docx` library for Microsoft Word format
- Supports proper heading hierarchy
- Includes metadata in document properties

### PDF
- Uses Puppeteer for high-quality PDF generation
- HTML-based rendering for better formatting
- Supports page breaks and proper typography

### TXT
- Plain text format with simple formatting
- Chapter titles with underlines
- Paragraph separation

### EPUB
- Uses `nodepub` library (secure alternative to epub-gen)
- Proper EPUB structure with chapters
- Metadata support for e-readers

## Background Processing

### Queue System
- Database-based job queue (no Redis dependency)
- Automatic retry with exponential backoff
- Job status tracking and error handling

### Export Processing Flow
1. User creates export request
2. Export record created in database
3. Job added to queue
4. Background processor picks up job
5. File generated based on format
6. Secure download link created
7. Export marked as completed

### Cleanup
- Expired exports automatically deleted (24-hour default)
- Old queue jobs cleaned up (7-day retention)
- Periodic cleanup runs every 24 hours

## Error Handling

### Common Errors
- **Project not found**: User doesn't own the project
- **Export not ready**: Export still processing
- **Download expired**: Download link has expired
- **File not found**: Export file was cleaned up

### Retry Logic
- Failed exports retry up to 3 times
- Exponential backoff between retries
- Permanent failure after max attempts

## Performance Considerations

### File Size Limits
- Large projects may take longer to process
- PDF generation is CPU-intensive
- EPUB generation requires memory for HTML processing

### Concurrent Processing
- Single queue processor to avoid resource conflicts
- Jobs processed sequentially
- Background processing doesn't block API responses

## Security Measures

### Access Control
- All operations require authentication
- Project ownership validation
- Secure token-based downloads

### File Security
- Files stored outside web root
- Time-limited download links
- Automatic cleanup of expired files

### Input Validation
- Request data validation with Zod schemas
- File path sanitization
- Content sanitization for HTML generation

## Monitoring and Logging

### Metrics to Monitor
- Export success/failure rates
- Processing times by format
- Queue depth and processing lag
- File storage usage

### Error Logging
- Failed export attempts with stack traces
- Queue processing errors
- File system errors
- Authentication failures

## Future Enhancements

### Potential Improvements
1. **Batch Exports**: Export multiple projects at once
2. **Custom Templates**: User-defined export templates
3. **Cover Images**: Support for book covers in EPUB/PDF
4. **Advanced Formatting**: Rich text formatting preservation
5. **Cloud Storage**: Integration with cloud storage providers
6. **Export Scheduling**: Scheduled exports for regular backups

### Scalability Considerations
1. **Redis Queue**: Migrate to Redis-based queue for high volume
2. **File Storage**: Move to cloud storage (AWS S3, etc.)
3. **Processing Workers**: Multiple worker processes
4. **Caching**: Cache frequently exported content