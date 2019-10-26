import * as Yup from 'yup';
import { startOfHour, parseISO, isBefore, format, subHours } from 'date-fns';
import ptBR from 'date-fns/locale/pt-BR';

import User from '../models/User';
import Appointment from '../models/Appointment';
import File from '../models/File';
import Notification from '../schemas/Notification';

class AppointmentController {
  async index(req, res) {
    const { page = 1 } = req.query;

    const appointments = await Appointment.findAll({
      where: { user_id: req.userId, canceled_at: null },
      order: ['date'],
      limit: 20,
      offset: (page - 1) * 20,
      attributes: ['id', 'user_id', 'date'],
      include: [
        {
          model: User,
          as: 'provider',
          attributes: ['id', 'name'],
          include: [
            {
              model: File,
              as: 'avatar',
              attributes: ['id', 'path', 'url'],
            },
          ],
        },
      ],
    });

    return res.json(appointments);
  }

  async store(req, res) {
    const schema = Yup.object().shape({
      provider_id: Yup.number().required(),
      date: Yup.date().required(),
    });

    if (!(await schema.isValid(req.body))) {
      return res.status(400).json({ error: 'Validation fails' });
    }

    const { provider_id, date } = req.body;

    /**
     * check if user is trying to make an appointment with yourself
     */

    if (provider_id === req.userId) {
      return res
        .status(401)
        .json({ error: 'You can not create an appointment with yourself' });
    }

    /**
     * check if provider_id is a provider
     */
    const isProvider = await User.findOne({
      where: { id: provider_id, provider: true },
    });

    if (!isProvider) {
      return res
        .status(401)
        .json({ error: 'You can only make appointments with a provider' });
    }

    /**
     * check for past dates
     */

    const hourStart = startOfHour(parseISO(date));

    console.log(hourStart);

    if (isBefore(hourStart, new Date())) {
      return res.status(400).json({ error: 'Past dates are not allowed' });
    }

    /**
     * check for availability
     */
    const checkAvailability = await Appointment.findOne({
      where: {
        provider_id,
        canceled_at: null,
        date: hourStart,
      },
    });

    if (checkAvailability) {
      return res
        .status(400)
        .json({ error: 'Appointment data is not available' });
    }

    const appointment = await Appointment.create({
      user_id: req.userId,
      provider_id,
      date: hourStart,
    });

    /**
     * Notify provider
     */

    const user = await User.findByPk(req.userId);
    const formatedDate = format(hourStart, "'dia' dd 'de' MMMM', às' H:mm'h'", {
      locale: ptBR,
    });

    await Notification.create({
      content: `Novo agendamento de ${user.name} para ${formatedDate}`,
      user: provider_id,
    });

    return res.json(appointment);
  }

  async delete(req, res) {
    const appointment = await Appointment.findByPk(req.params.id);

    /**
     * check if appointment belogs to logged user
     */
    if (appointment.user_id !== req.userId) {
      return res
        .status(401)
        .json({ error: 'You are not allowed to cancel this appointment' });
    }

    /**
     * appointments can be cancelled at least 2 hours in advance
     */
    const now = new Date();
    const subDate = subHours(appointment.date, 2);
    if (isBefore(subDate, now)) {
      return res.status(401).json({
        error: 'Appointments can only be cancelled 2 hours in advance',
      });
    }

    appointment.canceled_at = now;

    await appointment.save();

    return res.json(appointment);
  }
}

export default new AppointmentController();
