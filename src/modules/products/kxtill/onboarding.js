// src/modules/products/kxtill/onboarding.js
//
// KxTill onboarding template. Registered on boot alongside permissions.
// The central onboarding engine reads this when a KxTill OrganizationProduct
// is activated, and seeds OrganizationOnboarding + OnboardingTask rows.
//
// Each task:
//   key         — stable identifier
//   title       — short admin-facing label
//   description — one-line context for the admin
//   category    — ACCOUNT_SETUP | CONFIGURATION | TRAINING | COMMERCIAL | ADOPTION | HANDOVER
//   source      — 'template' for all seed tasks
//   autoCheck   — resolver key (optional) — resolved by onboarding-checks.service
//   required    — whether it counts toward progress
//   dueInDays   — default due offset from onboarding start (admin-adjustable later)

const onboarding = {
  templateKey: 'kxtill:v1',
  tasks: [
    // ─── ACCOUNT SETUP ──────────────────────────────────────
    {
      key: 'account_created',
      title: 'Customer account created',
      description: 'Customer has signed up via KXBYTE Identity',
      category: 'ACCOUNT_SETUP',
      source: 'template',
      autoCheck: 'account_exists',
      required: true,
      dueInDays: 1,
    },
    {
      key: 'default_branch',
      title: 'Default branch created',
      description: 'Main Branch auto-created with the organization',
      category: 'ACCOUNT_SETUP',
      source: 'template',
      autoCheck: 'branch_exists',
      required: true,
      dueInDays: 1,
    },
    {
      key: 'business_profile',
      title: 'Business information configured',
      description: 'Business name, contact details and location set',
      category: 'ACCOUNT_SETUP',
      source: 'template',
      required: true,
      dueInDays: 3,
    },
    {
      key: 'additional_branches',
      title: 'Additional branches added (if needed)',
      description: 'Customer has added any extra branches beyond the default',
      category: 'ACCOUNT_SETUP',
      source: 'template',
      required: false,
      dueInDays: 14,
    },

    // ─── CONFIGURATION ──────────────────────────────────────
    {
      key: 'inventory_setup',
      title: 'Initial inventory configured',
      description: 'Customer has added their initial products',
      category: 'CONFIGURATION',
      source: 'template',
      autoCheck: 'inventory_exists',
      required: true,
      dueInDays: 14,
    },
    {
      key: 'team_setup',
      title: 'Staff members added',
      description: 'Customer has invited at least one additional team member',
      category: 'CONFIGURATION',
      source: 'template',
      autoCheck: 'team_member_exists',
      required: true,
      dueInDays: 14,
    },
    {
      key: 'payment_method_set',
      title: 'Default payment method set',
      description: 'Customer has chosen their preferred payment method',
      category: 'CONFIGURATION',
      source: 'template',
      autoCheck: 'payment_config_exists',
      required: true,
      dueInDays: 14,
    },
    {
      key: 'mpesa_configured',
      title: 'M-Pesa configured',
      description: 'Customer has configured a valid M-Pesa integration',
      category: 'CONFIGURATION',
      source: 'template',
      autoCheck: 'mpesa_config_exists',
      required: true,
      dueInDays: 14,
    },
    {
      key: 'receipt_configured',
      title: 'Receipt details configured',
      description: 'Receipt header, footer, tax and business info reviewed',
      category: 'CONFIGURATION',
      source: 'template',
      required: false,
      dueInDays: 21,
    },

    // ─── TRAINING ───────────────────────────────────────────
    {
      key: 'product_demo',
      title: 'Product demonstration completed',
      description: 'KXBYTE team has demonstrated KxTill to the customer',
      category: 'TRAINING',
      source: 'template',
      required: true,
      dueInDays: 7,
    },
    {
      key: 'staff_training',
      title: 'Staff trained on daily POS operations',
      description: 'Cashiers and staff trained on day-to-day KxTill usage',
      category: 'TRAINING',
      source: 'template',
      required: true,
      dueInDays: 14,
    },
    {
      key: 'inventory_training',
      title: 'Inventory management explained',
      description: 'Customer understands adding products, stock and transfers',
      category: 'TRAINING',
      source: 'template',
      required: false,
      dueInDays: 21,
    },
    {
      key: 'sales_training',
      title: 'Sales, returns and reconciliation explained',
      description: 'Customer understands sales, refunds and shift reconciliation',
      category: 'TRAINING',
      source: 'template',
      required: false,
      dueInDays: 21,
    },

    // ─── COMMERCIAL ─────────────────────────────────────────
    {
      key: 'onboarding_contact',
      title: 'Customer contacted by KXBYTE',
      description: 'First onboarding call made to welcome and schedule setup',
      category: 'COMMERCIAL',
      source: 'template',
      required: true,
      dueInDays: 1,
    },
    {
      key: 'business_needs_assessed',
      title: 'Business requirements understood',
      description: 'Customer needs, pain points and setup expectations documented',
      category: 'COMMERCIAL',
      source: 'template',
      required: true,
      dueInDays: 7,
    },
    {
      key: 'subscription_confirmed',
      title: 'Subscription or commercial agreement confirmed',
      description: 'Pricing, plan and commercial arrangement agreed',
      category: 'COMMERCIAL',
      source: 'template',
      required: true,
      dueInDays: 14,
    },
    {
      key: 'customer_handover',
      title: 'Handed over to ongoing support',
      description: 'Support team knows about the customer and their setup',
      category: 'COMMERCIAL',
      source: 'template',
      required: true,
      dueInDays: 30,
    },

    // ─── ADOPTION ───────────────────────────────────────────
    {
      key: 'first_sale',
      title: 'First sale successfully recorded',
      description: 'Customer has completed a real sale through KxTill',
      category: 'ADOPTION',
      source: 'template',
      autoCheck: 'first_sale_exists',
      required: true,
      dueInDays: 30,
    },
    {
      key: 'go_live',
      title: 'Customer officially goes live',
      description: 'Customer is actively using KxTill as their primary POS',
      category: 'ADOPTION',
      source: 'template',
      required: true,
      dueInDays: 30,
    },
    {
      key: 'post_launch_followup',
      title: 'Post-launch follow-up completed',
      description: 'Checked in after launch to address issues and gather feedback',
      category: 'ADOPTION',
      source: 'template',
      required: false,
      dueInDays: 45,
    },
    {
      key: 'customer_feedback',
      title: 'Initial customer feedback collected',
      description: 'Customer feedback documented for product improvement',
      category: 'ADOPTION',
      source: 'template',
      required: false,
      dueInDays: 60,
    },
  ],
};

export default onboarding;