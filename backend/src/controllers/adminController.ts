import { Request, Response } from 'express';
import { supabase } from '../services/supabase';

export const adminImpersonateHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const { targetUserId } = req.body;
        const authHeader = req.headers.authorization;

        if (!authHeader) {
            res.status(401).json({ error: 'Missing authorization header' });
            return;
        }

        const token = authHeader.replace('Bearer ', '');
        
        const { data: { user }, error: authError } = await supabase.auth.getUser(token);
        
        if (authError || !user) {
            res.status(401).json({ error: 'Invalid admin token' });
            return;
        }

        const { data: adminProfile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

        if (adminProfile?.role !== 'superuser') {
            res.status(403).json({ error: 'Not authorized to impersonate' });
            return;
        }
        
        const { data: authUser, error: getUserError } = await supabase.auth.admin.getUserById(targetUserId);

        if (getUserError || !authUser.user) {
            res.status(500).json({ error: 'Could not fetch target user auth details' });
            return;
        }

        const email = authUser.user.email;
        if (!email) {
            res.status(400).json({ error: 'Target user has no email' });
            return;
        }

        const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
            type: 'magiclink',
            email: email,
        });

        if (linkError) {
            res.status(500).json({ error: 'Failed to generate link' });
            return;
        }

        res.json({ link: linkData.properties.action_link });
    } catch (e: any) {
        console.error('Impersonate error:', e);
        res.status(500).json({ error: e.message });
    }
};
