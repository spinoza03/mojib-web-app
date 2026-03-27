import { getAllActiveReminderConfigs, getAppointmentsNeedingReminder, markReminderSent, getActiveRestaurantProfiles, getPendingOrderNotifications, markOrderNotificationSent } from './supabase';
import { sendText } from './waha';

const REMINDER_CHECK_INTERVAL_MS = 2 * 60 * 1000; // Every 2 minutes

function formatReminderMessage(template: string, patientName: string, clinicName: string, appointmentTime: string): string {
    return template
        .replace(/\{patient_name\}/g, patientName)
        .replace(/\{clinic_name\}/g, clinicName)
        .replace(/\{time\}/g, appointmentTime);
}

function formatDateTime(isoString: string): string {
    const d = new Date(isoString);
    const day = d.toLocaleDateString('ar-MA', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const time = d.toLocaleTimeString('ar-MA', { hour: '2-digit', minute: '2-digit' });
    return `${day} ${time}`;
}

async function checkAndSendReminders() {
    try {
        const configs = await getAllActiveReminderConfigs();

        for (const config of configs) {
            for (const rule of config.reminder_rules) {
                const minutesBefore = rule.minutes_before;

                const appointments = await getAppointmentsNeedingReminder(config.doctor_id, minutesBefore);

                for (const apt of appointments) {
                    if (!apt.patient_phone) continue;

                    const chatId = apt.patient_phone.includes('@') 
                        ? apt.patient_phone 
                        : `${apt.patient_phone.replace(/\D/g, '')}@c.us`;

                    const formattedTime = formatDateTime(apt.start_time);
                    const message = formatReminderMessage(
                        config.reminder_message,
                        apt.patient_name || 'Patient',
                        config.clinic_name || 'Clinic',
                        formattedTime
                    );

                    console.log(`[Reminder] Sending to ${chatId} (${minutesBefore}min before) for Dr ${config.doctor_id}`);
                    await sendText(chatId, message, config.waha_session_name || undefined);
                    await markReminderSent(apt.id, minutesBefore);
                }
            }
        }
    } catch (error) {
        console.error('[Reminder Service] Error:', error);
    }

    // Restaurant order status notifications
    try {
        const restaurantProfiles = await getActiveRestaurantProfiles();

        if (restaurantProfiles.length > 0) {
            for (const profile of restaurantProfiles) {
                const orders = await getPendingOrderNotifications(profile.id);

                for (const order of orders) {
                    if (!order.customer_phone) continue;

                    const chatId = order.customer_phone.includes('@')
                        ? order.customer_phone
                        : `${order.customer_phone.replace(/\D/g, '')}@c.us`;

                    const restaurantName = profile.clinic_name || 'Restaurant';
                    let message = '';

                    const customMessage = profile.reminder_message || `مرحبا {customer_name} 🛵\nالطلبية ديالك من {restaurant_name} خرجات و فالطريق ليك! شوية و توصل. بالصحة و الراحة! 🍽️`;

                    if (order.status === 'out_for_delivery') {
                        message = customMessage
                            .replace(/\{customer_name\}/g, order.customer_name || 'عزيزي الزبون')
                            .replace(/\{patient_name\}/g, order.customer_name || 'عزيزي الزبون')
                            .replace(/\{restaurant_name\}/g, restaurantName)
                            .replace(/\{clinic_name\}/g, restaurantName);
                    } else if (order.status === 'ready_for_pickup') {
                        message = `مرحبا ${order.customer_name || 'عزيزي الزبون'} ✅\nالطلبية ديالك من ${restaurantName} جاهزة! تقدر تجي دير le pickup ديالها. بالصحة و الراحة! 🍽️`;
                    }

                    if (message) {
                        console.log(`[Restaurant Reminder] Sending ${order.status} notification to ${chatId} for ${restaurantName}`);
                        await sendText(chatId, message, profile.waha_session_name || undefined);
                        await markOrderNotificationSent(order.id, order.status);
                    }
                }
            }
        }
    } catch (error) {
        console.error('[Reminder Service] Restaurant notification error:', error);
    }
}

export function startReminderService() {
    console.log(`[Reminder Service] Started. Checking every ${REMINDER_CHECK_INTERVAL_MS / 1000}s.`);
    // Run once immediately, then on interval
    checkAndSendReminders();
    setInterval(checkAndSendReminders, REMINDER_CHECK_INTERVAL_MS);
}
