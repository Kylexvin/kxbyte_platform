// src/modules/platform/organizations/utils/slug.utils.js

import orgDb from '../db/org.db.js';

const generateSlug = async (name) => {
  // Convert to lowercase, replace spaces with hyphens, remove special chars
  let slug = name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');

  // Check if slug exists
  const existing = await orgDb.findOrganizationBySlug(slug);
  if (existing) {
    // Append random suffix
    const suffix = Math.random().toString(36).substring(2, 6);
    slug = `${slug}-${suffix}`;
  }

  return slug;
};

export { generateSlug };