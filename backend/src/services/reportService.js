import PDFDocument from 'pdfkit';
import jwt from 'jsonwebtoken';

export class ReportService {
  /**
   * Resolves the base URL for the backend service.
   * Handles cloud reverse proxies (e.g. Render, Railway, Heroku) via x-forwarded-proto,
   * environment overrides (APP_URL / BACKEND_URL), or local fallback.
   */
  static getBaseUrl(req) {
    if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
    if (process.env.BACKEND_URL) return process.env.BACKEND_URL.replace(/\/$/, '');
    if (req) {
      const proto = req.get('x-forwarded-proto') || req.protocol || 'http';
      const host = req.get('host');
      if (host) return `${proto}://${host}`;
    }
    return `http://localhost:${process.env.PORT || 5000}`;
  }

  /**
   * Generates the on-demand URL for viewing or downloading the incident report.
   * Attaches a secure signed token query param so browser links and window.open calls
   * are authenticated without storing static files on disk.
   */
  static getReportUrl(incidentId, options = {}) {
    const { req, token } = options;
    const baseUrl = this.getBaseUrl(req);
    const query = token ? `?token=${encodeURIComponent(token)}` : '';
    return `${baseUrl}/api/reports/${incidentId}${query}`;
  }

  /**
   * Legacy & Controller-compatible method:
   * Instead of writing a PDF to ephemeral disk, this generates an authenticated on-demand URL.
   * Any subsequent requests to this URL stream the live PDF directly from the database record.
   */
  static async generateIncidentPDF(incident, user, options = {}) {
    const { req } = options;
    let authToken = options.token;

    if (!authToken && process.env.JWT_SECRET) {
      authToken = jwt.sign(
        {
          incidentId: incident.id,
          userId: incident.userId,
          purpose: 'report_download'
        },
        process.env.JWT_SECRET,
        { expiresIn: '24h' }
      );
    }

    return this.getReportUrl(incident.id, { req, token: authToken });
  }

  /**
   * Populates a PDFKit document with the official ARIA Incident Dossier layout.
   */
  static buildPDF(doc, incident, user, baseUrl = '') {
    // Header Style Banner
    doc.rect(0, 0, 612, 100).fill('#e11d48'); // rose-600 color for brand identity
    
    doc.fillColor('#ffffff')
       .font('Helvetica-Bold')
       .fontSize(24)
       .text('ARIA - INCIDENT DOSSIER', 50, 35);
    doc.fontSize(10)
       .text('Official Emergency Dispatch Logs & Forensic Report', 50, 65);

    // Reset text configuration
    doc.fillColor('#1f2937').fontSize(12).font('Helvetica');

    // Document Details Table
    doc.moveDown(5);
    doc.fontSize(14).font('Helvetica-Bold').text('Incident Details', 50, 130);
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 150).lineTo(562, 150).stroke();

    doc.fontSize(11).font('Helvetica-Bold').text('Incident ID:', 50, 165);
    doc.font('Helvetica').text(incident.id, 160, 165);

    doc.font('Helvetica-Bold').text('Trigger Mechanism:', 50, 185);
    doc.font('Helvetica').text((incident.triggerType || 'manual').toUpperCase(), 160, 185);

    doc.font('Helvetica-Bold').text('Timestamp:', 50, 205);
    doc.font('Helvetica').text(new Date(incident.createdAt || Date.now()).toLocaleString(), 160, 205);

    doc.font('Helvetica-Bold').text('Current Status:', 50, 225);
    doc.font('Helvetica').text((incident.status || 'unknown').toUpperCase(), 160, 225);

    // User Metadata Section
    doc.fontSize(14).font('Helvetica-Bold').text('Victim Profile Details', 50, 260);
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 280).lineTo(562, 280).stroke();

    doc.fontSize(11).font('Helvetica-Bold').text('Victim Name:', 50, 295);
    doc.font('Helvetica').text(user ? user.name : 'Registered User', 160, 295);

    doc.font('Helvetica-Bold').text('Contact Phone:', 50, 315);
    doc.font('Helvetica').text(user ? user.phone : 'N/A', 160, 315);

    doc.font('Helvetica-Bold').text('Registered Email:', 50, 335);
    doc.font('Helvetica').text(user ? user.email : 'N/A', 160, 335);

    // Telemetry Details
    doc.fontSize(14).font('Helvetica-Bold').text('Telemetry & AI Evaluation', 50, 370);
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 390).lineTo(562, 390).stroke();

    doc.fontSize(11).font('Helvetica-Bold').text('GPS Coordinates:', 50, 405);
    doc.font('Helvetica').text(`Latitude: ${incident.latitude ?? 'N/A'}, Longitude: ${incident.longitude ?? 'N/A'}`, 160, 405);

    doc.font('Helvetica-Bold').text('AI Risk Score:', 50, 425);
    const riskScore = incident.riskScore ?? 0;
    const scoreColor = riskScore >= 70 ? '#dc2626' : (riskScore >= 40 ? '#d97706' : '#16a34a');
    doc.fillColor(scoreColor).font('Helvetica-Bold').text(`${riskScore}%`, 160, 425);
    doc.fillColor('#1f2937'); // restore original

    doc.font('Helvetica-Bold').text('Voice Transcript:', 50, 445);
    doc.font('Helvetica-Oblique').text(incident.audioTranscript ? `"${incident.audioTranscript}"` : 'No speech distress transcript matches recorded.', 160, 445, { width: 380 });

    // Evidence Links
    doc.fontSize(11).font('Helvetica-Bold').text('Evidence Links:', 50, 485);
    const hostBase = baseUrl || this.getBaseUrl(null);
    const evidenceUrl = `${hostBase}/uploads/evidence_${incident.id}.wav`;
    doc.fillColor('#3b82f6').font('Helvetica').text(evidenceUrl, 160, 485, { link: evidenceUrl });
    doc.fillColor('#1f2937');

    // Emergency Notification Details
    doc.moveDown(2);
    doc.fontSize(14).font('Helvetica-Bold').text('Emergency Notifications Logs', 50, 520);
    doc.strokeColor('#e5e7eb').lineWidth(1).moveTo(50, 540).lineTo(562, 540).stroke();

    let yOffset = 555;
    if (user && user.emergencyContacts && user.emergencyContacts.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').text('Emergency Contacts Notified via SMS Alerts:', 50, yOffset);
      yOffset += 15;
      user.emergencyContacts.forEach((contact, index) => {
        doc.fontSize(10).font('Helvetica').text(`${index + 1}. ${contact.name} - Phone: ${contact.phone} [Dispatched: OK]`, 70, yOffset);
        yOffset += 15;
      });
    } else {
      doc.fontSize(10).font('Helvetica-Oblique').text('No emergency contacts registered for this user.', 50, yOffset);
    }

    // Footer block
    doc.fontSize(9)
       .fillColor('#9ca3af')
       .text('GENERATED BY ARIA REPORT SERVICE', 50, 705, { align: 'center' });
    doc.text('This is an automatically generated safety record created by ARIA. All telemetry data is stored securely.', 50, 720, { align: 'center' });
  }

  /**
   * Streams the PDF report on demand into any writable stream (e.g. Express res).
   * Fully in-memory, completely avoiding local disk writes.
   */
  static streamIncidentPDF(incident, user, writableStream, baseUrl = '') {
    const doc = new PDFDocument({ margin: 50 });
    doc.pipe(writableStream);
    this.buildPDF(doc, incident, user, baseUrl);
    doc.end();
    return doc;
  }

  /**
   * Compiles the PDF report into an in-memory Buffer.
   */
  static async generateIncidentPDFBuffer(incident, user, baseUrl = '') {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const buffers = [];
        doc.on('data', chunk => buffers.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(buffers)));
        doc.on('error', err => reject(err));

        this.buildPDF(doc, incident, user, baseUrl);
        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }
}

export default ReportService;
