// src/modules/products/admin/crm/controllers/assignees.controller.js
//
// Lean picker list — active members of the current org.
// Gated by admin.leads.view (not admin.members.view): sales agents need
// a picker to assign leads, but should not see emails / roles / join dates
// of every staff member.

import orgDb from '../../../../platform/organizations/db/org.db.js';

export const list = async (req, res) => {
  try {
    const members = await orgDb.findMembershipsByOrganization(req.internalOrgId);
    const assignees = (members || [])
      .filter((m) => m.isActive && m.user)
      .map((m) => ({
        id: m.user.id,
        firstName: m.user.firstName,
        lastName: m.user.lastName,
      }))
      .sort((a, b) => `${a.firstName} ${a.lastName}`.localeCompare(`${b.firstName} ${b.lastName}`));

    res.json({ data: assignees });
  } catch (err) {
    console.error('admin crm assignees error:', err);
    res.status(500).json({ error: 'Internal server error' });
  }
};