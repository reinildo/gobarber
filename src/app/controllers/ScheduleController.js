import { startOfDay, endOfDay, parseISO } from 'date-fns';
import { Op } from 'sequelize';

import Appointments from '../models/Appointment';
import User from '../models/User';
import Appointment from '../models/Appointment';

class ScheduleControler {
  async index(req, res) {
    /**
     * check if user is a provider
     */
    const userIsProvider = await User.findOne({
      where: { id: req.userId, provider: true },
    });

    if (!userIsProvider) {
      return res.status(401).json({ error: 'User is not a provider' });
    }

    const { date } = req.query;
    const parsedDate = parseISO(date);

    const appointments = await Appointment.findAll({
      where: {
        provider_id: req.userId,
        canceled_at: null,
        date: {
          [Op.between]: [startOfDay(parsedDate), endOfDay(parsedDate)],
        },
      },
      order: ['date'],
    });

    return res.json(appointments);
  }
}

export default new ScheduleControler();
