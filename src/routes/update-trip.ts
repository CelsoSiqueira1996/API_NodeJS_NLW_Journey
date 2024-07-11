import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { ClientError } from "../erros/client-error";

export async function updateTrip(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().put('/trips/:tripId', {
        schema: {
            params: z.object({
                tripId: z.string().uuid()
            }),
            body: z.object({
                destination: z.string().min(4),
                starts_at: z.coerce.date(),
                ends_at: z.coerce.date() 
            })
        }
    }, async (req, res) => {
        const { tripId } = req.params;
        const { destination, starts_at, ends_at } = req.body;
        
        const trip = await prisma.trip.findUnique({
            where: {
                id: tripId
            }
        });

        if(!trip) {
            throw new Error('Trip does not exist.');
        }

        if(dayjs(starts_at).isBefore(new Date())) {
            throw new ClientError('Invalid trip start date.')
        }

        if(dayjs(ends_at).isBefore(starts_at)) {
            throw new ClientError('Invalid trip end date.')
        }

        const tripUpdated = await prisma.trip.update({
            where: {
                id: tripId
            },
            data: {
                destination,
                starts_at,
                ends_at
            }
        });

        res.status(200).send({message: 'Viagem atualizada com sucesso', trip: tripUpdated})

    })
}