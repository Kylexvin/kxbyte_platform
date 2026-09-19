import usersService from '../services/users.service.js';

export const list = async (req, res) => {
  try {
    const { search, page, limit } = req.query;
    const result = await usersService.listUsers({
      search,
      page: Number(page) || 1,
      limit: Number(limit) || 50,
    });
    res.json({ data: result.users, meta: { total: result.total, page: result.page, limit: result.limit } });
  } catch (err) {
    console.error('admin users list error:', err);
    res.status(500).json({ error: err.message });
  }
};

export const getOne = async (req, res) => {
  try {
    const user = await usersService.getUserDetail(req.params.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ data: user });
  } catch (err) {
    console.error('admin user detail error:', err);
    res.status(500).json({ error: err.message });
  }
};