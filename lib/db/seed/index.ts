import { loadEnvConfig } from '@next/env';
import 'dotenv/config';
import * as fs from 'fs';
import * as path from 'path';
import postgres from 'postgres';

const projectDir = process.cwd();
loadEnvConfig(projectDir);

interface PricingPlanGroup {
  slug: string;
  created_at: string;
}

interface PricingPlan {
  id: string;
  environment: string;
  group_slug: string;
  card_title: string;
  card_description: string | null;
  provider: string | null;
  stripe_price_id: string | null;
  stripe_product_id: string | null;
  stripe_coupon_id: string | null;
  creem_product_id: string | null;
  creem_discount_code: string | null;
  enable_manual_input_coupon: boolean;
  payment_type: string | null;
  recurring_interval: string | null;
  trial_period_days: number | null;
  price: string | null;
  currency: string | null;
  display_price: string | null;
  original_price: string | null;
  price_suffix: string | null;
  features: unknown[];
  is_highlighted: boolean;
  highlight_text: string | null;
  button_text: string | null;
  button_link: string | null;
  display_order: number;
  is_active: boolean;
  lang_jsonb: Record<string, unknown>;
  benefits_jsonb: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  console.log('Seeding database...');

  const client = postgres(connectionString);

  try {
    // Read JSON files
    const groupsFile = path.join(__dirname, 'pricing_plan_groups.json');
    const plansFile = path.join(__dirname, 'pricing_plans.json');

    const groups: PricingPlanGroup[] = JSON.parse(fs.readFileSync(groupsFile, 'utf-8'));
    const plans: PricingPlan[] = JSON.parse(fs.readFileSync(plansFile, 'utf-8'));

    // Insert pricing_plan_groups first (due to foreign key constraint)
    console.log(`Inserting ${groups.length} pricing plan groups...`);
    for (const group of groups) {
      await client`
        INSERT INTO pricing_plan_groups (slug, created_at)
        VALUES (${group.slug}, ${group.created_at})
        ON CONFLICT (slug) DO UPDATE SET
          created_at = EXCLUDED.created_at
      `;
    }
    console.log('Pricing plan groups inserted.');

    // Insert pricing_plans
    console.log(`Inserting ${plans.length} pricing plans...`);
    for (const plan of plans) {
      await client`
        INSERT INTO pricing_plans (
          id, environment, group_slug, card_title, card_description,
          provider, stripe_price_id, stripe_product_id, stripe_coupon_id,
          creem_product_id, creem_discount_code, enable_manual_input_coupon,
          payment_type, recurring_interval, trial_period_days,
          price, currency, display_price, original_price, price_suffix,
          features, is_highlighted, highlight_text, button_text, button_link,
          display_order, is_active, lang_jsonb, benefits_jsonb,
          created_at, updated_at
        )
        VALUES (
          ${plan.id}, ${plan.environment}, ${plan.group_slug}, ${plan.card_title}, ${plan.card_description},
          ${plan.provider}, ${plan.stripe_price_id}, ${plan.stripe_product_id}, ${plan.stripe_coupon_id},
          ${plan.creem_product_id}, ${plan.creem_discount_code}, ${plan.enable_manual_input_coupon},
          ${plan.payment_type}, ${plan.recurring_interval}, ${plan.trial_period_days},
          ${plan.price}, ${plan.currency}, ${plan.display_price}, ${plan.original_price}, ${plan.price_suffix},
          ${JSON.stringify(plan.features)}, ${plan.is_highlighted}, ${plan.highlight_text}, ${plan.button_text}, ${plan.button_link},
          ${plan.display_order}, ${plan.is_active}, ${JSON.stringify(plan.lang_jsonb)}, ${JSON.stringify(plan.benefits_jsonb)},
          ${plan.created_at}, ${plan.updated_at}
        )
        ON CONFLICT (id) DO UPDATE SET
          environment = EXCLUDED.environment,
          group_slug = EXCLUDED.group_slug,
          card_title = EXCLUDED.card_title,
          card_description = EXCLUDED.card_description,
          provider = EXCLUDED.provider,
          stripe_price_id = EXCLUDED.stripe_price_id,
          stripe_product_id = EXCLUDED.stripe_product_id,
          stripe_coupon_id = EXCLUDED.stripe_coupon_id,
          creem_product_id = EXCLUDED.creem_product_id,
          creem_discount_code = EXCLUDED.creem_discount_code,
          enable_manual_input_coupon = EXCLUDED.enable_manual_input_coupon,
          payment_type = EXCLUDED.payment_type,
          recurring_interval = EXCLUDED.recurring_interval,
          trial_period_days = EXCLUDED.trial_period_days,
          price = EXCLUDED.price,
          currency = EXCLUDED.currency,
          display_price = EXCLUDED.display_price,
          original_price = EXCLUDED.original_price,
          price_suffix = EXCLUDED.price_suffix,
          features = EXCLUDED.features,
          is_highlighted = EXCLUDED.is_highlighted,
          highlight_text = EXCLUDED.highlight_text,
          button_text = EXCLUDED.button_text,
          button_link = EXCLUDED.button_link,
          display_order = EXCLUDED.display_order,
          is_active = EXCLUDED.is_active,
          lang_jsonb = EXCLUDED.lang_jsonb,
          benefits_jsonb = EXCLUDED.benefits_jsonb,
          updated_at = EXCLUDED.updated_at
      `;
    }
    console.log('Pricing plans inserted.');

    console.log('Database seeded successfully.');
  } catch (error) {
    console.error('An error occurred while seeding the database:', error);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
