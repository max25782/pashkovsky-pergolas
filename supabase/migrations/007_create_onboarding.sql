-- ============================================
-- Phase 4: Onboarding & Legal
-- Create onboarding tasks table
-- ============================================

CREATE TABLE IF NOT EXISTS onboarding_tasks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  
  -- Task details
  task_key TEXT NOT NULL, -- 'create_project', 'invite_user', 'configure_settings', etc.
  title TEXT NOT NULL,
  title_he TEXT,
  title_ru TEXT,
  description TEXT,
  description_he TEXT,
  description_ru TEXT,
  
  -- Status
  completed BOOLEAN DEFAULT false,
  completed_at TIMESTAMPTZ,
  completed_by UUID REFERENCES users(id),
  
  -- Priority and order
  priority INT DEFAULT 0,
  sort_order INT DEFAULT 0,
  is_required BOOLEAN DEFAULT false,
  
  -- Metadata
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  
  UNIQUE(company_id, task_key)
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_onboarding_company ON onboarding_tasks(company_id);
CREATE INDEX IF NOT EXISTS idx_onboarding_completed ON onboarding_tasks(completed);
CREATE INDEX IF NOT EXISTS idx_onboarding_sort ON onboarding_tasks(sort_order);

-- Function to create default onboarding tasks for new company
CREATE OR REPLACE FUNCTION create_default_onboarding_tasks(p_company_id UUID)
RETURNS void AS $$
BEGIN
  INSERT INTO onboarding_tasks (company_id, task_key, title, title_he, title_ru, sort_order, is_required) VALUES
    (p_company_id, 'welcome', 'Welcome to the platform', 'ברוך הבא', 'Добро пожаловать', 1, true),
    (p_company_id, 'company_info', 'Complete company information', 'השלם פרטי חברה', 'Заполните данные компании', 2, true),
    (p_company_id, 'create_first_deal', 'Create your first deal', 'צור עסקה ראשונה', 'Создайте первую сделку', 3, false),
    (p_company_id, 'invite_team', 'Invite team members', 'הזמן חברי צוות', 'Пригласите команду', 4, false),
    (p_company_id, 'configure_settings', 'Configure settings', 'הגדר הגדרות', 'Настройте систему', 5, false),
    (p_company_id, 'explore_features', 'Explore key features', 'גלה תכונות עיקריות', 'Изучите возможности', 6, false);
END;
$$ LANGUAGE plpgsql;

-- Trigger to create onboarding tasks when new company is created
CREATE OR REPLACE FUNCTION trigger_create_onboarding_tasks()
RETURNS TRIGGER AS $$
BEGIN
  PERFORM create_default_onboarding_tasks(NEW.id);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS create_onboarding_tasks_on_company_creation ON companies;
CREATE TRIGGER create_onboarding_tasks_on_company_creation
  AFTER INSERT ON companies
  FOR EACH ROW
  EXECUTE FUNCTION trigger_create_onboarding_tasks();

-- Create onboarding tasks for existing companies (including Pashkovsky)
DO $$
DECLARE
  company_record RECORD;
BEGIN
  FOR company_record IN SELECT id FROM companies LOOP
    PERFORM create_default_onboarding_tasks(company_record.id);
  END LOOP;
  RAISE NOTICE '✅ Onboarding tasks created for all existing companies';
END $$;

-- Success message
DO $$
BEGIN
  RAISE NOTICE '✅ Onboarding tasks table created successfully';
  RAISE NOTICE '✅ Default tasks: welcome, company_info, create_first_deal, invite_team, configure_settings, explore_features';
END $$;


