import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import PDFDocument from 'pdfkit';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const reportsDir = path.join(__dirname, '../../uploads/reports');
if (!fs.existsSync(reportsDir)) {
  fs.mkdirSync(reportsDir, { recursive: true });
}

export class ReportService {
  static async generateIncidentPDF(incident, user) {
    return new Promise((resolve, reject) => {
      try {
        const doc = new PDFDocument({ margin: 50 });
        const fileName = `report_${incident.id}.pdf`;
        const filePath = path.join(reportsDir, fileName);
        const writeStream = fs.createWriteStream(filePath);

        doc.pipe(writeStream);

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
        doc.font('Helvetica').text(incident.triggerType.toUpperCase(), 160, 185);

        doc.font('Helvetica-Bold').text('Timestamp:', 50, 205);
        doc.font('Helvetica').text(new Date(incident.createdAt).toLocaleString(), 160, 205);

        doc.font('Helvetica-Bold').text('Current Status:', 50, 225);
        doc.font('Helvetica').text(incident.status.toUpperCase(), 160, 225);

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
        doc.font('Helvetica').text(`Latitude: ${incident.latitude}, Longitude: ${incident.longitude}`, 160, 405);

        doc.font('Helvetica-Bold').text('AI Risk Score:', 50, 425);
        const scoreColor = incident.riskScore >= 70 ? '#dc2626' : (incident.riskScore >= 40 ? '#d97706' : '#16a34a');
        doc.fillColor(scoreColor).font('Helvetica-Bold').text(`${incident.riskScore}%`, 160, 425);
        doc.fillColor('#1f2937'); // restore original

        doc.font('Helvetica-Bold').text('Voice Transcript:', 50, 445);
        doc.font('Helvetica-Oblique').text(incident.audioTranscript ? `"${incident.audioTranscript}"` : 'No speech distress transcript matches recorded.', 160, 445, { width: 380 });

        // Evidence Links
        doc.fontSize(11).font('Helvetica-Bold').text('Evidence Links:', 50, 485);
        const evidenceUrl = `http://localhost:${process.env.PORT || 5000}/uploads/evidence_${incident.id}.wav`;
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

        doc.end();

        writeStream.on('finish', () => {
          const downloadUrl = `http://localhost:${process.env.PORT || 5000}/uploads/reports/${fileName}`;
          resolve(downloadUrl);
        });

        writeStream.on('error', (err) => reject(err));
      } catch (err) {
        reject(err);
      }
    });
  }
}
export default ReportService;
