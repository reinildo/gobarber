import Notification from '../schemas/Notification';
import User from '../models/User';

class NotificationController {
  async index(req, res) {
    /**
     * check if user is a provider
     */
    const isProviderUser = await User.findOne({
      id: req.userId,
      provider: true,
    });

    if (!isProviderUser) {
      return res.status(401).json({ error: 'Acess denied' });
    }

    const notifications = await Notification.find({
      user: req.userId,
    })
      .sort({ createdAt: 'desc' })
      .limit(20);

    return res.json(notifications);
  }
}

export default new NotificationController();
