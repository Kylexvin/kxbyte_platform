import subscriberService from './subscriber.service.js';

const subscribe = async (req, res) => {
  try {
    const result = await subscriberService.subscribe(req.body || {}, req);
    res.status(200).json(result);
  } catch (error) {
    if (
      error.message === 'Email is required' ||
      error.message === 'Invalid email' ||
      error.message === 'Email too long'
    ) {
      return res.status(400).json({ error: error.message });
    }
    console.error('Subscribe error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export default { subscribe };