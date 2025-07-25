-- This file is a combination of all SQL files from the /data directory.
-- It is intended to be the initial migration for the database.

-- From: data/1、user.sql
CREATE TABLE public.users (
    id uuid NOT NULL PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL,
    email text UNIQUE NOT NULL,
    full_name text NULL,
    avatar_url text NULL,
    payment_provider text NULL,
    stripe_customer_id text UNIQUE NULL,
    role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user'))
);

COMMENT ON TABLE public.users IS 'Stores application-specific user profile data, extending the auth.users table.';
COMMENT ON COLUMN public.users.id IS 'Primary key, references auth.users.id.';
COMMENT ON COLUMN public.users.email IS 'User email, kept in sync with auth.users. Must be unique.';
COMMENT ON COLUMN public.users.stripe_customer_id IS 'Unique identifier for the user in Stripe.';

CREATE INDEX users_stripe_customer_id_idx ON public.users (stripe_customer_id);
CREATE INDEX users_email_idx ON public.users (email);

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_users_update
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE PROCEDURE public.handle_updated_at();

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users FORCE ROW LEVEL SECURITY;

-- =============================================
-- Create RLS Policies!
-- =============================================
-- Allow users to read their own profile
CREATE POLICY "Allow user read their own profile"
ON public.users FOR SELECT
USING (auth.uid() = id);

-- Allow user to update their own profile
  -- Only allows updating specific fields: full_name, avatar_url
  -- Add more fields as needed.
  -- See example usage in /actions/users/settings.ts -> supabase.rpc('update_my_profile', ...)
CREATE OR REPLACE FUNCTION update_my_profile(
    new_full_name TEXT,
    new_avatar_url TEXT
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  UPDATE public.users
  SET
    full_name = new_full_name,
    avatar_url = new_avatar_url
  WHERE id = auth.uid();
END;
$$;

GRANT EXECUTE ON FUNCTION update_my_profile(TEXT, TEXT) TO authenticated;


-- =============================================
-- Create Trigger for Profile Creation!
-- =============================================
-- 1. Create the function that will be called by the trigger
--    This function inserts a new row into public.users when a new user signs up in auth.users
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public -- Important for security and accessing public.users
as $$
begin
  -- Insert a new row into public.users
  -- Copies the id and email from the newly created auth.users record
  -- Sets the initial updated_at timestamp
  insert into public.users (id, email, updated_at)
  values (new.id, new.email, now());
  return new; -- The result is ignored on AFTER triggers, but it's good practice
end;
$$;

-- 2. Create the trigger that calls the function
--    This trigger fires automatically AFTER a new user is inserted into auth.users
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();
-- =============================================


-- From: data/2、pricing-plans.sql
CREATE TABLE public.pricing_plans (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    environment character varying(10) NOT NULL CHECK (environment IN ('test', 'live')),
    card_title text NOT NULL,
    card_description text NULL,
    stripe_price_id character varying(255) NULL,
    stripe_product_id character varying(255) NULL,
    stripe_coupon_id character varying(255) NULL,
    enable_manual_input_coupon boolean DEFAULT false NOT NULL,
    payment_type character varying(50) NULL,
    recurring_interval character varying(50) NULL,
    trial_period_days integer NULL,
    price numeric NULL,
    currency character varying(10) NULL,
    display_price character varying(50) NULL,
    original_price character varying(50) NULL,
    price_suffix character varying(100) NULL,
    features jsonb DEFAULT '[]'::jsonb NOT NULL,
    is_highlighted boolean DEFAULT false NOT NULL,
    highlight_text text NULL,
    button_text text NULL,
    button_link text NULL,
    display_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    lang_jsonb jsonb DEFAULT '{}'::jsonb NOT NULL,
    benefits_jsonb jsonb DEFAULT '{}'::jsonb
);

COMMENT ON TABLE public.pricing_plans IS 'Stores configuration for pricing plans displayed as cards on the frontend.';
COMMENT ON COLUMN public.pricing_plans.environment IS 'Specifies if the plan is for the ''test'' or ''live'' Stripe environment.';
COMMENT ON COLUMN public.pricing_plans.lang_jsonb IS 'Stores translations for text fields in JSON format, keyed by language code.';
COMMENT ON COLUMN public.pricing_plans.features IS 'JSON array of features, e.g., [{"description": "Feature One", "included": true}]';
COMMENT ON COLUMN public.pricing_plans.benefits_jsonb IS 'JSON object defining plan benefits. E.g., {"monthly_credits": 500} for recurring credits, {"one_time_credits": 1000} for one-off credits.';

CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_pricing_plans_updated
BEFORE UPDATE ON public.pricing_plans
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.pricing_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow public read access to active plans"
ON public.pricing_plans
FOR SELECT
TO PUBLIC
USING (is_active = true);


-- From: data/3、orders.sql
-- Create the public.orders table
CREATE TABLE public.orders (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    provider text NOT NULL,
    provider_order_id text NOT NULL,
    status text NOT NULL,
    order_type text NOT NULL,
    product_id text NULL,
    plan_id uuid NULL REFERENCES public.pricing_plans(id) ON DELETE SET NULL,
    price_id text NULL,
    amount_subtotal numeric NULL,
    amount_discount numeric NULL DEFAULT 0,
    amount_tax numeric NULL DEFAULT 0,
    amount_total numeric NOT NULL,
    currency text NOT NULL,
    subscription_provider_id text NULL,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.orders IS 'Stores all payment transactions and subscription lifecycle events.';
COMMENT ON COLUMN public.orders.id IS 'Unique order/record ID.';
COMMENT ON COLUMN public.orders.user_id IS 'Associated user ID from public.users.';
COMMENT ON COLUMN public.orders.provider IS 'Payment provider identifier (e.g., ''stripe'').';
COMMENT ON COLUMN public.orders.provider_order_id IS 'Provider''s unique ID for the transaction/subscription (e.g., pi_..., sub_..., cs_..., in_...).';
COMMENT ON COLUMN public.orders.status IS 'Order/subscription status (e.g., ''pending'', ''succeeded'', ''failed'', ''active'', ''canceled'', ''refunded'', ''past_due'', ''incomplete'').';
COMMENT ON COLUMN public.orders.order_type IS 'Type of order (e.g., ''one_time_purchase'', ''subscription_initial'', ''subscription_renewal'', ''refund'').';
COMMENT ON COLUMN public.orders.product_id IS 'Provider''s product ID.';
COMMENT ON COLUMN public.orders.plan_id IS 'Associated internal plan ID from public.pricing_plans.';
COMMENT ON COLUMN public.orders.price_id IS 'Provider''s price ID (e.g., price_...).';
COMMENT ON COLUMN public.orders.amount_subtotal IS 'Amount before discounts.';
COMMENT ON COLUMN public.orders.amount_discount IS 'Discount amount.';
COMMENT ON COLUMN public.orders.amount_tax IS 'Tax amount.';
COMMENT ON COLUMN public.orders.amount_total IS 'Final amount paid/due.';
COMMENT ON COLUMN public.orders.currency IS 'Currency code (e.g., ''usd'').';
COMMENT ON COLUMN public.orders.subscription_provider_id IS 'Associated Stripe subscription ID (sub_...) for subscription-related events.';
COMMENT ON COLUMN public.orders.metadata IS 'Stores additional information (e.g., Checkout Session metadata, refund reasons, coupon codes).';
COMMENT ON COLUMN public.orders.created_at IS 'Timestamp of record creation.';
COMMENT ON COLUMN public.orders.updated_at IS 'Timestamp of last record update.';


-- Create indexes on the public.orders table
CREATE INDEX idx_orders_user_id ON public.orders(user_id);
CREATE INDEX idx_orders_provider ON public.orders(provider);
CREATE INDEX idx_orders_subscription_provider_id ON public.orders(subscription_provider_id);
CREATE INDEX idx_orders_plan_id ON public.orders(plan_id);
CREATE UNIQUE INDEX idx_orders_provider_provider_order_id_unique ON public.orders(provider, provider_order_id);
CREATE UNIQUE INDEX IF NOT EXISTS unique_initial_subscription_record
ON public.orders (provider, subscription_provider_id)
WHERE order_type = 'subscription_initial';


-- Add the updated_at function & trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER handle_orders_updated_at
BEFORE UPDATE ON public.orders
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


-- Set up Row Level Security (RLS) for public.orders

-- Enable RLS on the table
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;

-- Allow users to read their own orders
CREATE POLICY "Allow user read own orders"
ON public.orders
FOR SELECT
USING (auth.uid() = user_id);

-- Disallow users from inserting, updating, or deleting orders directly
  -- Optional, but recommended to keep
CREATE POLICY "Disallow user insert orders"
ON public.orders
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Disallow user update orders"
ON public.orders
FOR UPDATE
USING (false);

CREATE POLICY "Disallow user delete orders"
ON public.orders
FOR DELETE
USING (false);


-- From: data/4、subscriptions.sql
CREATE TABLE public.subscriptions (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    plan_id uuid NOT NULL REFERENCES public.pricing_plans(id) ON DELETE RESTRICT,
    stripe_subscription_id text NOT NULL UNIQUE,
    stripe_customer_id text NOT NULL,
    price_id text NOT NULL,
    status text NOT NULL,
    current_period_start timestamptz NULL,
    current_period_end timestamptz NULL,
    cancel_at_period_end boolean NOT NULL DEFAULT false,
    canceled_at timestamptz NULL,
    ended_at timestamptz NULL,
    trial_start timestamptz NULL,
    trial_end timestamptz NULL,
    metadata jsonb NULL,
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.subscriptions IS 'Stores the current state and details of user subscriptions, synced from Stripe.';
COMMENT ON COLUMN public.subscriptions.id IS 'Unique identifier for the subscription record in this table.';
COMMENT ON COLUMN public.subscriptions.user_id IS 'Foreign key referencing the user associated with this subscription.';
COMMENT ON COLUMN public.subscriptions.plan_id IS 'Foreign key referencing the internal pricing plan associated with this subscription.';
COMMENT ON COLUMN public.subscriptions.stripe_subscription_id IS 'The unique subscription ID from Stripe (sub_...). Used as the primary link to Stripe data.';
COMMENT ON COLUMN public.subscriptions.stripe_customer_id IS 'The Stripe customer ID (cus_...) associated with this subscription.';
COMMENT ON COLUMN public.subscriptions.price_id IS 'The specific Stripe Price ID (price_...) for the subscription item being tracked.';
COMMENT ON COLUMN public.subscriptions.status IS 'The current status of the subscription as reported by Stripe (e.g., active, trialing, past_due, canceled).';
COMMENT ON COLUMN public.subscriptions.current_period_start IS 'Timestamp marking the beginning of the current billing period.';
COMMENT ON COLUMN public.subscriptions.current_period_end IS 'Timestamp marking the end of the current billing period.';
COMMENT ON COLUMN public.subscriptions.cancel_at_period_end IS 'Indicates if the subscription is scheduled to cancel at the end of the current billing period.';
COMMENT ON COLUMN public.subscriptions.canceled_at IS 'Timestamp when the subscription was formally canceled in Stripe.';
COMMENT ON COLUMN public.subscriptions.ended_at IS 'Timestamp indicating when the subscription access definitively ended (e.g., after cancellation or failed payment grace period).';
COMMENT ON COLUMN public.subscriptions.trial_start IS 'Timestamp marking the beginning of the trial period, if applicable.';
COMMENT ON COLUMN public.subscriptions.trial_end IS 'Timestamp marking the end of the trial period, if applicable.';
COMMENT ON COLUMN public.subscriptions.metadata IS 'JSONB field to store additional context or metadata from Stripe or the application.';
COMMENT ON COLUMN public.subscriptions.created_at IS 'Timestamp indicating when this subscription record was first created in the database.';
COMMENT ON COLUMN public.subscriptions.updated_at IS 'Timestamp indicating when this subscription record was last updated.';

CREATE INDEX idx_subscriptions_user_id ON public.subscriptions(user_id);
CREATE INDEX idx_subscriptions_status ON public.subscriptions(status);
CREATE INDEX idx_subscriptions_plan_id ON public.subscriptions(plan_id);
CREATE INDEX idx_subscriptions_stripe_customer_id ON public.subscriptions(stripe_customer_id);

CREATE TRIGGER handle_subscriptions_updated_at
BEFORE UPDATE ON public.subscriptions
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own subscriptions"
ON public.subscriptions
FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Disallow user insert subscriptions"
ON public.subscriptions
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Disallow user update subscriptions"
ON public.subscriptions
FOR UPDATE
USING (false);

CREATE POLICY "Disallow user delete subscriptions"
ON public.subscriptions
FOR DELETE
USING (false);


-- From: data/5、usage.sql
-- Create the 'usage' table to store user credits balances.
CREATE TABLE public.usage (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL UNIQUE REFERENCES public.users(id) ON DELETE CASCADE,
    subscription_credits_balance integer NOT NULL DEFAULT 0 CHECK (subscription_credits_balance >= 0),
    one_time_credits_balance integer NOT NULL DEFAULT 0 CHECK (one_time_credits_balance >= 0),
    balance_jsonb jsonb NOT NULL DEFAULT '{}',
    created_at timestamptz NOT NULL DEFAULT now(),
    updated_at timestamptz NOT NULL DEFAULT now()
);

COMMENT ON TABLE public.usage IS 'Stores usage data like credits balances for each user.';
COMMENT ON COLUMN public.usage.user_id IS 'Foreign key referencing the user associated with this usage record.';
COMMENT ON COLUMN public.usage.subscription_credits_balance IS 'Balance of credits granted via subscription, typically reset periodically upon successful payment.';
COMMENT ON COLUMN public.usage.one_time_credits_balance IS 'Balance of credits acquired through one-time purchases, accumulates over time.';
COMMENT ON COLUMN public.usage.balance_jsonb IS 'JSONB object to store additional balance information.';
COMMENT ON COLUMN public.usage.created_at IS 'Timestamp of when the user''s usage record was first created.';
COMMENT ON COLUMN public.usage.updated_at IS 'Timestamp of the last modification to the user''s usage record.';


CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER on_usage_updated
BEFORE UPDATE ON public.usage
FOR EACH ROW
EXECUTE FUNCTION public.handle_updated_at();


ALTER TABLE public.usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user read own usage"
ON public.usage
FOR SELECT USING (auth.uid() = user_id);

-- Disallow users from inserting, updating, or deleting usage directly
  -- Optional, but recommended to keep
CREATE POLICY "Disallow user insert usage"
ON public.usage
FOR INSERT
WITH CHECK (false);

CREATE POLICY "Disallow user update usage"
ON public.usage
FOR UPDATE
USING (false);

CREATE POLICY "Disallow user delete usage"
ON public.usage
FOR DELETE
USING (false);


-- From: data/6、credit_logs.sql
-- Create the table to store credit transaction logs
CREATE TABLE public.credit_logs (
    id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id uuid NOT NULL REFERENCES auth.users(id),
    amount INT NOT NULL, -- The amount of credits changed. Positive for addition, negative for deduction.
    one_time_balance_after INT NOT NULL, -- The user's one-time credit balance after this transaction.
    subscription_balance_after INT NOT NULL, -- The user's subscription credit balance after this transaction.
    type TEXT NOT NULL, -- The type of transaction, e.g., 'feature_usage', 'one_time_purchase', 'subscription_grant', 'refund_revoke'.
    notes TEXT, -- Additional details about the transaction, e.g., "Used AI summary feature".
    related_order_id uuid REFERENCES public.orders(id), -- Optional foreign key to the orders table.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

COMMENT ON COLUMN public.credit_logs.amount IS 'The amount of credits changed. Positive for additions, negative for deductions.';
COMMENT ON COLUMN public.credit_logs.one_time_balance_after IS 'The user''s one-time credit balance after this transaction.';
COMMENT ON COLUMN public.credit_logs.subscription_balance_after IS 'The user''s subscription credit balance after this transaction.';
COMMENT ON COLUMN public.credit_logs.type IS 'Type of transaction (e.g., ''feature_usage'', ''one_time_purchase'').';
COMMENT ON COLUMN public.credit_logs.notes IS 'Additional details or notes about the transaction.';
COMMENT ON COLUMN public.credit_logs.related_order_id IS 'Optional foreign key to the `orders` table, linking the log to a purchase or refund.';

CREATE INDEX idx_credit_logs_user_id ON public.credit_logs(user_id);

ALTER TABLE public.credit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow user to read their own credit logs"
ON public.credit_logs
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Disallow user to modify credit logs"
ON public.credit_logs
FOR ALL USING (false) WITH CHECK (false);


--------------------------------------------------------------------------------
-- create RPCs
--------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.deduct_credits_and_log(
    p_user_id uuid,
    p_deduct_amount integer,
    p_notes text
)
RETURNS boolean AS $$
DECLARE
    v_current_one_time_credits integer;
    v_current_subscription_credits integer;
    v_total_credits integer;
    v_deducted_from_subscription integer;
    v_deducted_from_one_time integer;
    v_new_one_time_balance integer;
    v_new_subscription_balance integer;
BEGIN
    SELECT one_time_credits_balance, subscription_credits_balance
    INTO v_current_one_time_credits, v_current_subscription_credits
    FROM public.usage
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN false;
    END IF;

    v_total_credits := v_current_one_time_credits + v_current_subscription_credits;

    IF v_total_credits < p_deduct_amount THEN
        RETURN false;
    END IF;

    v_deducted_from_subscription := LEAST(v_current_subscription_credits, p_deduct_amount);
    v_deducted_from_one_time := p_deduct_amount - v_deducted_from_subscription;

    v_new_subscription_balance := v_current_subscription_credits - v_deducted_from_subscription;
    v_new_one_time_balance := v_current_one_time_credits - v_deducted_from_one_time;

    UPDATE public.usage
    SET
        subscription_credits_balance = v_new_subscription_balance,
        one_time_credits_balance = v_new_one_time_balance
    WHERE user_id = p_user_id;

    INSERT INTO public.credit_logs(user_id, amount, one_time_balance_after, subscription_balance_after, type, notes)
    VALUES (p_user_id, -p_deduct_amount, v_new_one_time_balance, v_new_subscription_balance, 'feature_usage', p_notes);

    RETURN true;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


CREATE OR REPLACE FUNCTION public.grant_one_time_credits_and_log(
    p_user_id uuid,
    p_credits_to_add integer,
    p_related_order_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_new_one_time_balance integer;
    v_new_subscription_balance integer;
BEGIN
    INSERT INTO public.usage (user_id, one_time_credits_balance, subscription_credits_balance)
    VALUES (p_user_id, p_credits_to_add, 0)
    ON CONFLICT (user_id)
    DO UPDATE SET one_time_credits_balance = usage.one_time_credits_balance + p_credits_to_add
    RETURNING one_time_credits_balance, subscription_credits_balance INTO v_new_one_time_balance, v_new_subscription_balance;

    INSERT INTO public.credit_logs(user_id, amount, one_time_balance_after, subscription_balance_after, type, notes, related_order_id)
    VALUES (p_user_id, p_credits_to_add, v_new_one_time_balance, v_new_subscription_balance, 'one_time_purchase', 'One-time credit purchase', p_related_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--- [v2.x UPDATE] grant_subscription_credits_and_log
DROP FUNCTION IF EXISTS public.grant_subscription_credits_and_log(uuid, integer, uuid);
CREATE OR REPLACE FUNCTION public.grant_subscription_credits_and_log(
    p_user_id uuid,
    p_credits_to_set integer,
    p_related_order_id uuid DEFAULT NULL
)
RETURNS void AS $$
DECLARE
    v_new_one_time_balance integer;
    v_new_subscription_balance integer;
    v_monthly_details jsonb;
BEGIN
    v_monthly_details := jsonb_build_object(
        'monthly_allocation_details', jsonb_build_object(
            'monthly_credits', p_credits_to_set
        )
    );
    INSERT INTO public.usage (user_id, one_time_credits_balance, subscription_credits_balance, balance_jsonb)
    VALUES (p_user_id, 0, p_credits_to_set, v_monthly_details)
    ON CONFLICT (user_id)
    DO UPDATE SET
        subscription_credits_balance = p_credits_to_set,
        balance_jsonb = COALESCE(public.usage.balance_jsonb, '{}'::jsonb) - 'monthly_allocation_details' || v_monthly_details
    RETURNING one_time_credits_balance, subscription_credits_balance INTO v_new_one_time_balance, v_new_subscription_balance;

    INSERT INTO public.credit_logs(user_id, amount, one_time_balance_after, subscription_balance_after, type, notes, related_order_id)
    VALUES (p_user_id, p_credits_to_set, v_new_one_time_balance, v_new_subscription_balance, 'subscription_grant', 'Subscription credits granted/reset', p_related_order_id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

--- [v2.x ADD] initialize_or_reset_yearly_allocation
DROP FUNCTION IF EXISTS public.initialize_or_reset_yearly_allocation(uuid, integer, integer, timestamptz, uuid);
CREATE OR REPLACE FUNCTION initialize_or_reset_yearly_allocation(
    p_user_id uuid,
    p_total_months integer,
    p_monthly_credits integer,
    p_subscription_start_date timestamptz,
    p_related_order_id uuid DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_yearly_details jsonb;
    v_new_one_time_balance integer;
    v_new_subscription_balance integer;
BEGIN
    v_yearly_details := jsonb_build_object(
        'yearly_allocation_details', jsonb_build_object(
            'remaining_months', p_total_months - 1,
            'next_credit_date', p_subscription_start_date + INTERVAL '1 month',
            'monthly_credits', p_monthly_credits,
            'last_allocated_month', to_char(p_subscription_start_date, 'YYYY-MM')
        )
    );

    INSERT INTO public.usage (user_id, subscription_credits_balance, balance_jsonb)
    VALUES (p_user_id, p_monthly_credits, v_yearly_details)
    ON CONFLICT (user_id)
    DO UPDATE SET
        subscription_credits_balance = p_monthly_credits,
        balance_jsonb = COALESCE(public.usage.balance_jsonb, '{}'::jsonb) - 'yearly_allocation_details' || v_yearly_details
    RETURNING one_time_credits_balance, subscription_credits_balance INTO v_new_one_time_balance, v_new_subscription_balance;

    INSERT INTO public.credit_logs(user_id, amount, one_time_balance_after, subscription_balance_after, type, notes, related_order_id)
    VALUES (p_user_id, p_monthly_credits, v_new_one_time_balance, v_new_subscription_balance, 'subscription_grant', 'Yearly plan initial credits granted', p_related_order_id);
END;
$$;


--- [v2.x ADD] allocate_specific_monthly_credit_for_year_plan
DROP FUNCTION IF EXISTS public.allocate_specific_monthly_credit_for_year_plan(uuid, integer, text);
CREATE OR REPLACE FUNCTION allocate_specific_monthly_credit_for_year_plan(
    p_user_id uuid,
    p_monthly_credits integer,
    p_current_yyyy_mm text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_usage_record RECORD;
    v_yearly_details jsonb;
    v_new_yearly_details jsonb;
BEGIN
    SELECT * INTO v_usage_record FROM public.usage WHERE user_id = p_user_id FOR UPDATE;

    IF NOT FOUND THEN
        RAISE WARNING 'User usage record not found for user_id: %', p_user_id;
        RETURN;
    END IF;

    v_yearly_details := v_usage_record.balance_jsonb->'yearly_allocation_details';

    IF v_yearly_details IS NULL THEN
        RAISE WARNING 'Yearly allocation details not found for user_id: %', p_user_id;
        RETURN;
    END IF;

    IF (v_yearly_details->>'remaining_months')::integer > 0 AND
        NOW() >= (v_yearly_details->>'next_credit_date')::timestamptz AND
        v_yearly_details->>'last_allocated_month' <> p_current_yyyy_mm THEN

        v_new_yearly_details := jsonb_set(
            jsonb_set(
                jsonb_set(
                    v_yearly_details,
                    '{remaining_months}',
                    to_jsonb((v_yearly_details->>'remaining_months')::integer - 1)
                ),
                '{next_credit_date}',
                to_jsonb((v_yearly_details->>'next_credit_date')::timestamptz + INTERVAL '1 month')
            ),
            '{last_allocated_month}',
            to_jsonb(p_current_yyyy_mm)
        );

        UPDATE public.usage
        SET
            subscription_credits_balance = p_monthly_credits,
            balance_jsonb = jsonb_set(usage.balance_jsonb, '{yearly_allocation_details}', v_new_yearly_details)
        WHERE user_id = p_user_id;

    ELSE
      RAISE LOG 'Skipping credit allocation for user % for month % (remaining: %, next_date: %, last_allocated: %)', 
                  p_user_id, p_current_yyyy_mm, v_yearly_details->>'remaining_months', v_yearly_details->>'next_credit_date', v_yearly_details->>'last_allocated_month';
    END IF;
END;
$$;

--- [v2.x UPDATE] revoke_credits_and_log
DROP FUNCTION IF EXISTS public.revoke_credits_and_log(uuid, integer, integer, text, text, uuid);
CREATE OR REPLACE FUNCTION public.revoke_credits_and_log(
    p_user_id uuid,
    p_revoke_one_time integer,
    p_revoke_subscription integer,
    p_log_type text,
    p_notes text,
    p_related_order_id uuid DEFAULT NULL,
    p_clear_yearly_details boolean DEFAULT false,
    p_clear_monthly_details boolean DEFAULT false
)
RETURNS void AS $$
DECLARE
    v_current_one_time_bal integer;
    v_current_sub_bal integer;
    v_new_one_time_bal integer;
    v_new_sub_bal integer;
    v_current_balance_jsonb jsonb;
    v_new_balance_jsonb jsonb;
    v_amount_revoked integer;
BEGIN
    IF p_revoke_one_time < 0 OR p_revoke_subscription < 0 THEN
        RAISE WARNING 'Revoke amounts cannot be negative. User: %, One-Time: %, Subscription: %', p_user_id, p_revoke_one_time, p_revoke_subscription;
        RETURN;
    END IF;

    SELECT
        one_time_credits_balance,
        subscription_credits_balance,
        balance_jsonb
    INTO
        v_current_one_time_bal,
        v_current_sub_bal,
        v_current_balance_jsonb
    FROM public.usage
    WHERE user_id = p_user_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN;
    END IF;

    v_new_one_time_bal := GREATEST(0, v_current_one_time_bal - p_revoke_one_time);
    v_new_sub_bal := GREATEST(0, v_current_sub_bal - p_revoke_subscription);

    v_new_balance_jsonb := COALESCE(v_current_balance_jsonb, '{}'::jsonb);
    
    IF p_clear_yearly_details THEN
        v_new_balance_jsonb := v_new_balance_jsonb - 'yearly_allocation_details';
    END IF;
    
    IF p_clear_monthly_details THEN
        v_new_balance_jsonb := v_new_balance_jsonb - 'monthly_allocation_details';
    END IF;

    IF v_new_one_time_bal <> v_current_one_time_bal OR 
        v_new_sub_bal <> v_current_sub_bal OR 
        v_new_balance_jsonb <> v_current_balance_jsonb THEN
        
        UPDATE public.usage
        SET
            one_time_credits_balance = v_new_one_time_bal,
            subscription_credits_balance = v_new_sub_bal,
            balance_jsonb = v_new_balance_jsonb
        WHERE user_id = p_user_id;

        v_amount_revoked := (v_current_one_time_bal - v_new_one_time_bal) + (v_current_sub_bal - v_new_sub_bal);

        IF v_amount_revoked > 0 THEN
            INSERT INTO public.credit_logs(user_id, amount, one_time_balance_after, subscription_balance_after, type, notes, related_order_id)
            VALUES (p_user_id, -v_amount_revoked, v_new_one_time_bal, v_new_sub_bal, p_log_type, p_notes, p_related_order_id);
        END IF;
    END IF;

EXCEPTION
    WHEN others THEN
        RAISE WARNING 'Error in revoke_credits_and_log for user %: %', p_user_id, SQLERRM;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- From: data/7、posts.sql
DO $$ BEGIN
    CREATE TYPE post_status AS ENUM ('draft', 'published', 'archived');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
    CREATE TYPE post_visibility AS ENUM ('public', 'logged_in', 'subscribers');
EXCEPTION
    WHEN duplicate_object THEN null;
END $$;


-- 1. Posts Table
CREATE TABLE public.posts (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    language VARCHAR(10) NOT NULL,
    author_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE SET NULL,
    title TEXT NOT NULL,
    slug TEXT NOT NULL,
    content TEXT,
    description TEXT,
    -- URL to the featured image stored in R2/S3
    featured_image_url TEXT,
    is_pinned BOOLEAN NOT NULL DEFAULT false,
    status post_status NOT NULL DEFAULT 'draft',
    visibility post_visibility NOT NULL DEFAULT 'public',
    published_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT posts_language_slug_unique UNIQUE (language, slug)
);

CREATE INDEX idx_posts_author_id ON public.posts(author_id);
CREATE INDEX idx_posts_status ON public.posts(status);
CREATE INDEX idx_posts_visibility ON public.posts(visibility);
CREATE INDEX idx_posts_published_at ON public.posts(published_at);
CREATE INDEX idx_posts_language_status ON public.posts(language, status);
CREATE INDEX idx_posts_is_pinned ON public.posts(is_pinned) WHERE is_pinned = true;

CREATE OR REPLACE FUNCTION public.handle_published_at()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'published' AND (OLD.status IS NULL OR OLD.status != 'published') THEN
        NEW.published_at = now();
    ELSIF NEW.status != 'published' THEN
        NEW.published_at = NULL;
    END IF;
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_published_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_published_at();

CREATE TRIGGER insert_posts_published_at
BEFORE INSERT ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.handle_published_at();

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_posts_updated_at
BEFORE UPDATE ON public.posts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();


-- 2. Tags Table
CREATE TABLE public.tags (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT tags_name_unique UNIQUE (name)
);

CREATE INDEX idx_tags_name ON public.tags(name);


-- 3. Post_Tags Linking Table (Many-to-Many)
CREATE TABLE public.post_tags (
    post_id UUID NOT NULL REFERENCES public.posts(id) ON DELETE CASCADE,
    tag_id UUID NOT NULL REFERENCES public.tags(id) ON DELETE CASCADE,

    PRIMARY KEY (post_id, tag_id)
);

CREATE INDEX idx_post_tags_tag_id ON public.post_tags(tag_id);
CREATE INDEX idx_post_tags_post_id ON public.post_tags(post_id);


-- Enable RLS for the tables
ALTER TABLE public.posts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tags ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.post_tags ENABLE ROW LEVEL SECURITY;

-- Allow public read access to published, public posts
CREATE POLICY "Allow public read access to published posts" ON public.posts
    FOR SELECT USING (status = 'published' AND visibility = 'public');

-- Allow logged-in users read access to published, logged_in posts
CREATE POLICY "Allow logged-in users read access" ON public.posts
    FOR SELECT USING (status = 'published' AND visibility = 'logged_in' AND auth.role() = 'authenticated');

-- Allow authors to read their own posts regardless of status/visibility
CREATE POLICY "Allow authors to read their own posts" ON public.posts
    FOR SELECT USING (auth.uid() = author_id);

-- Allow authors to manage their own drafts (adjust permissions as needed)
CREATE POLICY "Allow authors to update their own drafts" ON public.posts
    FOR UPDATE USING (auth.uid() = author_id AND status = 'draft')
    WITH CHECK (auth.uid() = author_id);

-- Allow authors to delete their own drafts
CREATE POLICY "Allow authors to delete their own drafts" ON public.posts
    FOR DELETE USING (auth.uid() = author_id AND status = 'draft');


-- Tags & Post_Tags Policies
-- Allow public read access to tags
CREATE POLICY "Allow public read access to tags" ON public.tags
    FOR SELECT USING (true);

-- Allow public read access to post_tags links
CREATE POLICY "Allow public read access to post_tags" ON public.post_tags
    FOR SELECT USING (true); 