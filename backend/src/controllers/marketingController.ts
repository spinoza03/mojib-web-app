import { Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { sendBulkText } from '../services/waha';

export const sendBulkMarketingHandler = async (req: Request, res: Response): Promise<void> => {
    try {
        const { user_id, customer_ids, message } = req.body;

        if (!user_id || !customer_ids?.length || !message) {
            res.status(400).json({ error: 'Missing user_id, customer_ids, or message' });
            return;
        }

        // Verify the user exists and has a restaurant niche with active subscription
        const { data: profile } = await supabase
            .from('profiles')
            .select('id, clinic_name, waha_session_name, niche, subscription_status')
            .eq('id', user_id)
            .maybeSingle();

        if (!profile || profile.niche !== 'restaurant') {
            res.status(403).json({ error: 'Not authorized or not a restaurant profile' });
            return;
        }

        if (!['pro', 'trial', 'active'].includes(profile.subscription_status)) {
            res.status(403).json({ error: 'Subscription not active' });
            return;
        }

        // Fetch customer phones
        const { data: customers } = await supabase
            .from('restaurant_customers')
            .select('id, full_name, phone')
            .eq('user_id', user_id)
            .in('id', customer_ids);

        if (!customers || customers.length === 0) {
            res.status(404).json({ error: 'No customers found' });
            return;
        }

        const chatIds = customers
            .filter((c: any) => c.phone)
            .map((c: any) => {
                const phone = c.phone.replace(/\D/g, '');
                return phone.includes('@') ? phone : `${phone}@c.us`;
            });

        if (chatIds.length === 0) {
            res.status(400).json({ error: 'No valid phone numbers found' });
            return;
        }

        // Personalize and send
        const result = await sendBulkText(chatIds, message, profile.waha_session_name || undefined);

        res.status(200).json({
            status: 'success',
            sent: result.sent,
            failed: result.failed,
            total: chatIds.length
        });
    } catch (error) {
        console.error('[Marketing] Bulk send error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};
