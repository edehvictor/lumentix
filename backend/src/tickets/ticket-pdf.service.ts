import { Injectable } from '@nestjs/common';
import * as PDFDocument from 'pdfkit';
import { TicketEntity } from './entities/ticket.entity';
import { Event } from '../events/entities/event.entity';
import { User } from '../users/entities/user.entity';

@Injectable()
export class TicketPdfService {
  async generate(
    ticket: TicketEntity,
    event: Event,
    user: User,
    qrDataUrl: string,
  ): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const doc = new PDFDocument({ size: 'A5', margin: 40 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      doc.fontSize(20).text(event.title, { align: 'center' });
      doc.moveDown(0.5);

      doc.fontSize(11).text(`Date: ${new Date(event.startDate).toUTCString()}`);
      if (event.location) doc.text(`Location: ${event.location}`);
      doc.text(`Attendee: ${user.email}`);
      doc.text(`Ticket ID: ${ticket.id}`);
      doc.moveDown();

      // Embed QR code image from data URL
      const base64Data = qrDataUrl.replace(/^data:image\/\w+;base64,/, '');
      const imgBuffer = Buffer.from(base64Data, 'base64');
      doc.image(imgBuffer, { fit: [150, 150], align: 'center' });

      doc.end();
    });
  }
}
