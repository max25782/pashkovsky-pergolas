-- ==========================================
-- Link authenticated user to existing company
-- ==========================================
-- Run this in Supabase SQL Editor
-- ==========================================

DO $$
DECLARE
    v_user_id uuid := '41bc1d19-aa1f-4427-b739-98003bea8528';
    v_company_id uuid := '6998295e-89ae-4e3d-afd2-8c2b0333eac2';
    v_member_count int;
BEGIN
    -- Check if user is already linked to this company
    SELECT COUNT(*) INTO v_member_count
    FROM public.company_members
    WHERE user_id = v_user_id AND company_id = v_company_id;
    
    IF v_member_count > 0 THEN
        RAISE NOTICE 'User is already linked to company';
    ELSE
        -- Check if there's an orphaned member record (user_id is NULL or different)
        SELECT COUNT(*) INTO v_member_count
        FROM public.company_members
        WHERE company_id = v_company_id;
        
        IF v_member_count > 0 THEN
            -- Update existing member record
            RAISE NOTICE 'Updating existing company_member record...';
            
            UPDATE public.company_members
            SET 
                user_id = v_user_id,
                role = 'owner',
                permissions = '{"all": true}'::jsonb,
                updated_at = NOW()
            WHERE company_id = v_company_id;
            
            RAISE NOTICE 'Updated company_member record';
        ELSE
            -- Create new member record
            RAISE NOTICE 'Creating new company_member record...';
            
            INSERT INTO public.company_members (
                user_id,
                company_id,
                role,
                permissions,
                created_at,
                updated_at
            ) VALUES (
                v_user_id,
                v_company_id,
                'owner',
                '{"all": true}'::jsonb,
                NOW(),
                NOW()
            );
            
            RAISE NOTICE 'Created new company_member record';
        END IF;
    END IF;
    
    -- Verify the result
    RAISE NOTICE '=== Verification Complete ===';
    
END $$;

-- Display the result
SELECT 
    cm.user_id,
    au.email,
    cm.company_id,
    c.name as company_name,
    cm.role,
    cm.permissions
FROM public.company_members cm
JOIN auth.users au ON au.id = cm.user_id
JOIN public.companies c ON c.id = cm.company_id
WHERE cm.user_id = '41bc1d19-aa1f-4427-b739-98003bea8528';

