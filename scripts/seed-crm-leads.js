// scripts/seed-crm-leads.js
//
// Populates the kxbyte CRM pipeline with sample leads for board/list testing.
// Only touches the kxbyte org. Lead names are prefixed with "SEED — " so
// CLEAN=1 can remove them without affecting real data.
//
// Usage:
//   node scripts/seed-crm-leads.js
//   CLEAN=1 node scripts/seed-crm-leads.js   # remove all seeded leads

import 'dotenv/config';
import prisma from '../src/database/postgres/prisma.js';
import leadsService from '../src/modules/products/kxcrm/services/leads.service.js';
import activitiesService from '../src/modules/products/kxcrm/services/activities.service.js';

const KXBYTE_SLUG = 'kxbyte';
const PREFIX = 'SEED — ';

const LEADS = [
  // --- new (3) ---
  {
    stageKey: 'new',
    businessName: `${PREFIX}Kariobangi Fresh Produce`,
    contactName: 'Mary Wambui',
    contactPhone: '+254711100101',
    contactEmail: 'mary@kariobangifresh.test',
    source: 'SHOP_VISIT',
    businessSize: 'SMALL',
    location: 'Kariobangi, Nairobi',
    interestedProduct: 'KxTill',
    dealValue: 38000,
    notes: 'Small shop, interested in basic plan.',
  },
  {
    stageKey: 'new',
    businessName: `${PREFIX}Rongai Hardware`,
    contactName: 'Joseph Mwangi',
    contactPhone: '+254711100102',
    source: 'WEBSITE',
    businessSize: 'MEDIUM',
    location: 'Rongai',
    interestedProduct: 'KxTill',
    notes: 'Filled the contact form on the site.',
  },
  {
    stageKey: 'new',
    businessName: `${PREFIX}Muthaiga Florist`,
    contactName: 'Grace Njoki',
    contactPhone: '+254711100103',
    source: 'INSTAGRAM',
    sourceDetail: '@muthaigaflorist',
    businessSize: 'SMALL',
    location: 'Muthaiga',
    interestedProduct: 'KxWork',
  },

  // --- contacted (2) ---
  {
    stageKey: 'contacted',
    businessName: `${PREFIX}Thika Road Auto Spares`,
    contactName: 'Peter Kimani',
    contactPhone: '+254711100201',
    source: 'REFERRAL',
    sourceDetail: 'Referred by Rongai Hardware',
    dealValue: 85000,
    businessSize: 'MEDIUM',
    location: 'Thika Road',
    interestedProduct: 'KxTill',
    notes: 'Called once, interested in invoicing features.',
  },
  {
    stageKey: 'contacted',
    businessName: `${PREFIX}Westlands Dental Clinic`,
    contactName: 'Dr. Aisha Omar',
    contactPhone: '+254711100202',
    contactEmail: 'aisha@westlandsdental.test',
    source: 'DIRECT_CALL',
    dealValue: 250000,
    businessSize: 'SMALL',
    location: 'Westlands',
    interestedProduct: 'Custom web app',
    notes: 'Wants a patient booking portal.',
  },

  // --- qualified (2) ---
  {
    stageKey: 'qualified',
    businessName: `${PREFIX}Kilimani Wine Shop`,
    contactName: 'Samuel Okoth',
    contactPhone: '+254711100301',
    source: 'WHATSAPP',
    dealValue: 62000,
    businessSize: 'SMALL',
    location: 'Kilimani',
    interestedProduct: 'KxTill',
  },
  {
    stageKey: 'qualified',
    businessName: `${PREFIX}Karen Equestrian Centre`,
    contactName: 'Elizabeth Wairimu',
    contactPhone: '+254711100302',
    contactEmail: 'elizabeth@karenequestrian.test',
    source: 'REFERRAL',
    sourceDetail: 'Via existing customer',
    dealValue: 480000,
    businessSize: 'LARGE',
    location: 'Karen',
    interestedProduct: 'KxWork + custom',
  },

  // --- demo (2) ---
  {
    stageKey: 'demo',
    businessName: `${PREFIX}Lavington Pharmacy`,
    contactName: 'Patrick Ngugi',
    contactPhone: '+254711100401',
    contactEmail: 'patrick@lavingtonpharmacy.test',
    source: 'CAMPAIGN',
    sourceDetail: 'Pharmacy outreach Q4',
    dealValue: 145000,
    businessSize: 'MEDIUM',
    location: 'Lavington',
    interestedProduct: 'KxTill Pharmacy',
    notes: 'Demo done, wants to see batch tracking in action.',
  },
  {
    stageKey: 'demo',
    businessName: `${PREFIX}Parklands Sports Bar`,
    contactName: 'Daniel Otieno',
    contactPhone: '+254711100402',
    source: 'SHOP_VISIT',
    dealValue: 92000,
    businessSize: 'MEDIUM',
    location: 'Parklands',
    interestedProduct: 'KxTill',
    notes: 'Liked the shift management demo.',
  },

  // --- proposal (1) ---
  {
    stageKey: 'proposal',
    businessName: `${PREFIX}Ngong Road Bookshop`,
    contactName: 'Catherine Muthoni',
    contactPhone: '+254711100501',
    source: 'REFERRAL',
    sourceDetail: 'From Kariobangi Fresh',
    dealValue: 45000,
    businessSize: 'SMALL',
    location: 'Ngong Road',
    interestedProduct: 'KxTill',
    notes: 'Proposal sent 5 days ago. Awaiting reply.',
  },

  // --- negotiation (1) ---
  {
    stageKey: 'negotiation',
    businessName: `${PREFIX}Gigiri Café`,
    contactName: 'Anthony Kamau',
    contactPhone: '+254711100601',
    contactEmail: 'anthony@gigiricafe.test',
    source: 'WEBSITE',
    dealValue: 175000,
    businessSize: 'MEDIUM',
    location: 'Gigiri',
    interestedProduct: 'KxTill',
    notes: 'Negotiating on annual pricing. Wants 10% discount.',
  },

  // --- won (2) ---
  {
    stageKey: 'won',
    businessName: `${PREFIX}Mombasa Road Tyres`,
    contactName: 'Rashid Abdalla',
    contactPhone: '+254711100701',
    contactEmail: 'rashid@mombasaroadtyres.test',
    source: 'REFERRAL',
    sourceDetail: 'Referred by Thika Road Auto Spares',
    dealValue: 125000,
    businessSize: 'MEDIUM',
    location: 'Mombasa Road',
    interestedProduct: 'KxTill',
    notes: 'Signed. Awaiting customer signup.',
  },
  {
    stageKey: 'won',
    businessName: `${PREFIX}Upper Hill Legal Chambers`,
    contactName: 'Njoroge Kariuki',
    contactPhone: '+254711100702',
    contactEmail: 'njoroge@upperhilllegal.test',
    source: 'CAMPAIGN',
    sourceDetail: 'Professional services campaign',
    dealValue: 320000,
    businessSize: 'SMALL',
    location: 'Upper Hill',
    interestedProduct: 'KxWork',
    notes: 'Won — very interested in document workflow.',
  },

  // --- lost (1) ---
  {
    stageKey: 'lost',
    businessName: `${PREFIX}Kasarani Butchery`,
    contactName: 'John Mwaura',
    contactPhone: '+254711100801',
    source: 'SHOP_VISIT',
    businessSize: 'SMALL',
    location: 'Kasarani',
    interestedProduct: 'KxTill',
    lostReason: 'Already using a competitor POS they are locked into.',
  },
];

// ============================================================
// HELPERS
// ============================================================

const lookupKxbyte = async () => {
  const org = await prisma.organization.findUnique({
    where: { slug: KXBYTE_SLUG },
    select: { id: true, ownerId: true },
  });
  if (!org) throw new Error(`Org '${KXBYTE_SLUG}' not found`);
  return { organizationId: org.id, actorId: org.ownerId };
};

const loadStages = async (organizationId) => {
  const stages = await prisma.pipelineStage.findMany({
    where: { organizationId, isActive: true },
    orderBy: { order: 'asc' },
  });
  if (stages.length === 0) {
    throw new Error('Pipeline not configured — apply template first');
  }
  const byKey = Object.fromEntries(stages.map((s) => [s.key, s]));
  return { stages, byKey };
};

const cleanup = async (organizationId) => {
  const seeds = await prisma.lead.findMany({
    where: { organizationId, businessName: { startsWith: PREFIX } },
    select: { id: true },
  });
  if (seeds.length === 0) {
    console.log('[cleanup] no seeded leads to remove');
    return;
  }
  const ids = seeds.map((l) => l.id);
  await prisma.leadActivity.deleteMany({ where: { leadId: { in: ids } } });
  await prisma.lead.deleteMany({ where: { id: { in: ids } } });
  console.log(`[cleanup] removed ${ids.length} seeded lead(s)`);
};

// ============================================================
// MAIN
// ============================================================

const main = async () => {
  const { organizationId, actorId } = await lookupKxbyte();

  if (process.env.CLEAN === '1') {
    await cleanup(organizationId);
    return;
  }

  const { stages, byKey } = await loadStages(organizationId);
  const wonStage = stages.find((s) => s.isWon && s.isActive);
  const lostStage = stages.find((s) => s.isLost && s.isActive);
  if (!wonStage || !lostStage) {
    throw new Error('Pipeline needs an active Won and Lost stage');
  }

  // First-stage for terminal-target leads: pick the lowest-order non-terminal stage.
  const firstNonTerminal = stages.find((s) => !s.isWon && !s.isLost);
  if (!firstNonTerminal) {
    throw new Error('No non-terminal stage to create leads in');
  }

  let created = 0;
  let skipped = 0;
  const tally = {};

  for (const spec of LEADS) {
    const exists = await prisma.lead.findFirst({
      where: { organizationId, businessName: spec.businessName, deletedAt: null },
      select: { id: true },
    });
    if (exists) {
      skipped++;
      continue;
    }

    const target = byKey[spec.stageKey];
    if (!target) {
      console.warn(`[skip] unknown stage '${spec.stageKey}' for ${spec.businessName}`);
      skipped++;
      continue;
    }

    const isTerminal = target.isWon || target.isLost;
    // Non-terminal: create directly in target. Terminal: create in first, then walk.
    const createStageId = isTerminal ? firstNonTerminal.id : target.id;

    const lead = await leadsService.createLead(actorId, organizationId, {
      businessName: spec.businessName,
      contactName: spec.contactName,
      contactPhone: spec.contactPhone,
      contactEmail: spec.contactEmail,
      source: spec.source,
      sourceDetail: spec.sourceDetail,
      businessSize: spec.businessSize,
      location: spec.location,
      interestedProduct: spec.interestedProduct,
      dealValue: spec.dealValue,
      currency: 'KES',
      notes: spec.notes,
      stageId: createStageId,
    });

    // Activities for non-terminal leads.
    if (!isTerminal) {
      await activitiesService.logActivity(actorId, organizationId, lead.id, {
        type: 'CALL',
        summary: `Initial outreach — called ${spec.contactName}`,
        outcome: 'NEUTRAL',
      });
      if (['demo', 'qualified', 'proposal', 'negotiation'].includes(spec.stageKey)) {
        await activitiesService.logActivity(actorId, organizationId, lead.id, {
          type: 'MEETING',
          summary: 'Discovery meeting completed',
          outcome: 'POSITIVE',
        });
      }
    }

    // Terminal transition.
    if (isTerminal) {
      if (target.isWon) {
        await leadsService.promoteLeadToWon(actorId, organizationId, lead.id);
      } else {
        await leadsService.moveLeadToStage(actorId, organizationId, lead.id, target.id, {
          lostReason: spec.lostReason || 'No reason provided',
        });
      }
    }

    tally[spec.stageKey] = (tally[spec.stageKey] || 0) + 1;
    created++;
    console.log(`[ok] ${spec.businessName} → ${target.name}`);
  }

  console.log(`\n[seed] created=${created} skipped=${skipped}`);
  console.log('[seed] distribution:', tally);
};

main()
  .catch((err) => {
    console.error('FATAL:', err.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());