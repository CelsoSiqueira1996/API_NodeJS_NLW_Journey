import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { getEmailClient } from "../lib/mail";
import nodemailer from 'nodemailer';
import { ClientError } from "../erros/client-error";
import { env } from "../env";

export async function createInvite(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().post('/trips/:tripId/invites', {
        schema: {
            params: z.object({
                tripId: z.string().uuid()
            }),
            body: z.object({
                emails_participants: z.array(z.string().email())
            })
        }
    }, async (req, res) => {
        const { tripId } = req.params;
        const { emails_participants } = req.body;

        const trip = await prisma.trip.findUnique({
            where: {
                id: tripId
            }
        });

        if(!trip) {
            throw new ClientError('Trip does not exist.');
        }

        await prisma.participant.createMany({
            data: emails_participants.map((email) => ({trip_Id: tripId, email}))
        });

        const participants = await prisma.participant.findMany({
            where: {
                trip_Id: tripId,
                email: {
                    in: emails_participants
                }
            }
        })
        const formattedStartDate = dayjs(trip.starts_at).format('LL');
        const formattedEndDate = dayjs(trip.ends_at).format('LL');

        const mail = await getEmailClient();

        await Promise.all(
            participants.map(async (participant) => {
                const confirmationLink = `${env.API_BASE_URL}/participants/${participant.id}/confirm`
                const message = await mail.sendMail({
                    from: {
                        name: 'Equipe plann.er',
                        address: 'oi@planner.com.br'
                    },
                    to: participant.email,
                    subject: `Confirme sua presença na viagem para ${trip.destination} em ${formattedStartDate}`,
                    html: `
                    <div style="font-family: sans-serif; font-size: 16px; line-height: 1.6;">
                        <p>Você foi convidado(a) para participar de uma viagem para <strong>${trip.destination}</strong> nas datas de <strong>${formattedStartDate}</strong> até <strong>${formattedEndDate}</strong>.</p>
                        <p></p>
                        <p>Para confirmar sua presença na viagem, clique no link abaixo:</p>
                        <p></p>
                        <p><a href="${confirmationLink}">Confirmar viagem</a></p>
                        <p></p>
                        <p>Caso você não saiba do que se trata este e-mail, apenas ignore-o.</p>
                    </div>
                    `.trim()
                });
        
                console.log(nodemailer.getTestMessageUrl(message)); 
            })
        )

        res.status(200).send({participants});
    })
}