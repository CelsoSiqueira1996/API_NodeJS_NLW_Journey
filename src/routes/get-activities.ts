import { FastifyInstance } from "fastify";
import { ZodTypeProvider } from "fastify-type-provider-zod";
import z from "zod";
import { prisma } from "../lib/prisma";
import { dayjs } from "../lib/dayjs";
import { ClientError } from "../erros/client-error";

export async function getActivities(app: FastifyInstance) {
    app.withTypeProvider<ZodTypeProvider>().get('/trips/:tripId/activities', {
        schema: {
            params: z.object({
                tripId: z.string().uuid()
            })
        }
    }, async (req, res) => {
        const { tripId } = req.params;
        const trip = await prisma.trip.findUnique({
            where: {
                id: tripId
            },
            include: {
                activities: {
                    orderBy: {
                        occurs_at: 'asc'
                    }
                }
            }    
        });

        if(!trip) {
            throw new ClientError('Trip does not exist!');
        }

        const differenceInDaysBetweenTripStartAndEnd = dayjs(trip.ends_at).diff(trip.starts_at, 'days');
        
        const activities = Array.from({ length: differenceInDaysBetweenTripStartAndEnd + 1 })
            .map((_,index) => {
                const date = dayjs(trip.starts_at).add(index, 'days');
                return {
                    date,
                    activities: trip.activities.filter((activity) => dayjs(activity.occurs_at).isSame(date, 'day'))
    }});

        res.status(200).send({activities: activities});
    })
}
