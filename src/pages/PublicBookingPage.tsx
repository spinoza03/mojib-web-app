import { useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar as CalendarIcon, Clock, CheckCircle2, Loader2, ArrowLeft } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Toaster } from '@/components/ui/toaster';
import { motion, AnimatePresence } from 'framer-motion';

type Step = 'date' | 'time' | 'info' | 'success';

export default function PublicBookingPage() {
  const { token } = useParams<{ token: string }>();
  const { toast } = useToast();
  const [step, setStep] = useState<Step>('date');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [patientName, setPatientName] = useState('');
  const [patientPhone, setPatientPhone] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch clinic config via RPC
  const { data: clinic, isLoading: clinicLoading, error: clinicError } = useQuery({
    queryKey: ['public_booking_config', token],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_booking_config', { p_share_token: token });
      if (error) throw error;
      return data as {
        user_id: string;
        clinic_name: string;
        niche: string;
        working_hours: string;
        slot_interval_minutes: number;
        slot_capacity: number;
      } | null;
    },
    enabled: !!token,
  });

  // Fetch existing appointments for the selected date
  const { data: existingSlots } = useQuery({
    queryKey: ['public_slots', token, selectedDate],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('get_public_available_slots', {
        p_share_token: token,
        p_date: selectedDate,
      });
      if (error) throw error;
      return (data || []) as Array<{ start_time: string; end_time: string; status: string }>;
    },
    enabled: !!token && !!selectedDate,
  });

  // Generate available time slots
  const availableSlots = useMemo(() => {
    if (!clinic || !selectedDate) return [];

    const interval = clinic.slot_interval_minutes || 30;
    const capacity = clinic.slot_capacity || 1;

    // Parse working hours (e.g., "09:00 - 18:00" or "9h-18h")
    let startHour = 9, endHour = 18;
    if (clinic.working_hours) {
      const match = clinic.working_hours.match(/(\d{1,2})[h:]?\s*[-–]\s*(\d{1,2})/);
      if (match) {
        startHour = parseInt(match[1]);
        endHour = parseInt(match[2]);
      }
    }

    const slots: string[] = [];
    const now = new Date();
    const isToday = selectedDate === now.toISOString().split('T')[0];

    for (let h = startHour; h < endHour; h++) {
      for (let m = 0; m < 60; m += interval) {
        const timeStr = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;

        // Skip past times if today
        if (isToday) {
          const slotTime = new Date(`${selectedDate}T${timeStr}`);
          if (slotTime <= now) continue;
        }

        // Count how many appointments exist at this time
        const slotStart = new Date(`${selectedDate}T${timeStr}:00`);
        const bookedCount = (existingSlots || []).filter(apt => {
          const aptStart = new Date(apt.start_time);
          return aptStart.getTime() === slotStart.getTime();
        }).length;

        if (bookedCount < capacity) {
          slots.push(timeStr);
        }
      }
    }

    return slots;
  }, [clinic, selectedDate, existingSlots]);

  const handleSubmit = async () => {
    if (!patientName || !patientPhone) {
      toast({ variant: 'destructive', title: 'Missing Fields', description: 'Please fill in your name and phone number.' });
      return;
    }

    setIsSubmitting(true);

    const interval = clinic?.slot_interval_minutes || 30;
    const startTime = new Date(`${selectedDate}T${selectedTime}:00`);
    const endTime = new Date(startTime.getTime() + interval * 60000);

    const { data, error } = await supabase.rpc('book_public_appointment', {
      p_share_token: token,
      p_patient_name: patientName,
      p_patient_phone: patientPhone.replace(/\s/g, ''),
      p_start_time: startTime.toISOString(),
      p_end_time: endTime.toISOString(),
      p_notes: notes,
    });

    setIsSubmitting(false);

    if (error || data?.error) {
      toast({ variant: 'destructive', title: 'Booking Failed', description: error?.message || data?.error || 'Something went wrong.' });
    } else {
      setStep('success');
    }
  };

  // Get minimum date (today)
  const minDate = new Date().toISOString().split('T')[0];

  if (clinicLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white">
        <Loader2 className="h-8 w-8 animate-spin text-[#2589D0]" />
      </div>
    );
  }

  if (clinicError || !clinic) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-white p-4">
        <Card className="max-w-md w-full shadow-xl">
          <CardContent className="p-8 text-center">
            <div className="h-16 w-16 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-4">
              <CalendarIcon className="h-8 w-8 text-red-500" />
            </div>
            <h2 className="text-xl font-bold mb-2">Booking Unavailable</h2>
            <p className="text-muted-foreground">This booking link is invalid or has expired. Please contact the clinic directly.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const nicheLabel = clinic.niche === 'beauty_center' ? 'center' : clinic.niche === 'immobilier' ? 'agency' : 'clinic';

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-blue-50 p-4 flex items-center justify-center">
      <Toaster />
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-lg"
      >
        <Card className="shadow-2xl border-0 overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-[#2589D0] to-[#1a6fb0] p-6 text-white">
            <h1 className="text-2xl font-bold">{clinic.clinic_name}</h1>
            <p className="text-blue-100 text-sm mt-1">Book your appointment online</p>
          </div>

          <CardContent className="p-6">
            <AnimatePresence mode="wait">
              {/* STEP 1: Select Date */}
              {step === 'date' && (
                <motion.div key="date" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-4">
                    <div className="flex items-center gap-2 text-sm text-muted-foreground mb-4">
                      <CalendarIcon className="h-4 w-4" />
                      <span>Step 1 of 3 - Select a date</span>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-base font-semibold">Choose a date</Label>
                      <Input
                        type="date"
                        value={selectedDate}
                        min={minDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="text-lg p-3 h-12"
                      />
                    </div>
                    {clinic.working_hours && (
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Clock className="h-3 w-3" /> Working hours: {clinic.working_hours}
                      </p>
                    )}
                    <Button
                      className="w-full h-12 text-base"
                      style={{ backgroundColor: '#2589D0' }}
                      disabled={!selectedDate}
                      onClick={() => setStep('time')}
                    >
                      Continue
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 2: Select Time */}
              {step === 'time' && (
                <motion.div key="time" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-4">
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground -ml-2" onClick={() => setStep('date')}>
                      <ArrowLeft className="h-4 w-4" /> Change date
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>Step 2 of 3 - Select a time slot</span>
                    </div>
                    <p className="text-sm font-medium">
                      Available slots for {new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </p>
                    {availableSlots.length === 0 ? (
                      <div className="text-center py-8">
                        <p className="text-muted-foreground">No available slots for this date.</p>
                        <Button variant="outline" className="mt-3" onClick={() => setStep('date')}>Choose another date</Button>
                      </div>
                    ) : (
                      <div className="grid grid-cols-3 gap-2 max-h-[300px] overflow-y-auto pr-1">
                        {availableSlots.map(time => (
                          <Button
                            key={time}
                            variant={selectedTime === time ? 'default' : 'outline'}
                            className="h-11 text-sm font-semibold"
                            style={selectedTime === time ? { backgroundColor: '#2589D0' } : {}}
                            onClick={() => setSelectedTime(time)}
                          >
                            {time}
                          </Button>
                        ))}
                      </div>
                    )}
                    <Button
                      className="w-full h-12 text-base"
                      style={{ backgroundColor: '#2589D0' }}
                      disabled={!selectedTime}
                      onClick={() => setStep('info')}
                    >
                      Continue
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* STEP 3: Patient Info */}
              {step === 'info' && (
                <motion.div key="info" initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}>
                  <div className="space-y-4">
                    <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground -ml-2" onClick={() => setStep('time')}>
                      <ArrowLeft className="h-4 w-4" /> Change time
                    </Button>
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <CheckCircle2 className="h-4 w-4" />
                      <span>Step 3 of 3 - Your information</span>
                    </div>

                    {/* Summary */}
                    <div className="bg-blue-50 rounded-lg p-3 flex items-center gap-3 text-sm">
                      <CalendarIcon className="h-5 w-5 text-[#2589D0]" />
                      <div>
                        <span className="font-semibold">{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</span>
                        <span className="mx-2">at</span>
                        <span className="font-semibold">{selectedTime}</span>
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1.5">
                        <Label>Full Name *</Label>
                        <Input
                          value={patientName}
                          onChange={(e) => setPatientName(e.target.value)}
                          placeholder="e.g. Sara Ahmed"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Phone Number *</Label>
                        <Input
                          value={patientPhone}
                          onChange={(e) => setPatientPhone(e.target.value)}
                          placeholder="+212 6XX XXX XXX"
                          className="h-11"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <Label>Reason for visit (optional)</Label>
                        <Input
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder="Brief description..."
                          className="h-11"
                        />
                      </div>
                    </div>

                    <Button
                      className="w-full h-12 text-base"
                      style={{ backgroundColor: '#2589D0' }}
                      disabled={isSubmitting || !patientName || !patientPhone}
                      onClick={handleSubmit}
                    >
                      {isSubmitting ? (
                        <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Booking...</>
                      ) : (
                        'Confirm Booking'
                      )}
                    </Button>
                  </div>
                </motion.div>
              )}

              {/* SUCCESS */}
              {step === 'success' && (
                <motion.div key="success" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }}>
                  <div className="text-center py-8 space-y-4">
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ type: 'spring', stiffness: 200, delay: 0.2 }}
                      className="h-20 w-20 rounded-full bg-green-100 flex items-center justify-center mx-auto"
                    >
                      <CheckCircle2 className="h-10 w-10 text-green-500" />
                    </motion.div>
                    <h2 className="text-2xl font-bold">Appointment Confirmed!</h2>
                    <p className="text-muted-foreground">
                      Your appointment at <strong>{clinic.clinic_name}</strong> has been booked for{' '}
                      <strong>{new Date(selectedDate + 'T12:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}</strong> at <strong>{selectedTime}</strong>.
                    </p>
                    <div className="bg-blue-50 rounded-lg p-4 text-sm text-blue-700">
                      You may receive a reminder via WhatsApp before your appointment.
                    </div>
                    <Button
                      variant="outline"
                      onClick={() => {
                        setStep('date');
                        setSelectedDate('');
                        setSelectedTime('');
                        setPatientName('');
                        setPatientPhone('');
                        setNotes('');
                      }}
                    >
                      Book Another Appointment
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-muted-foreground mt-4">
          Powered by Mojib.AI
        </p>
      </motion.div>
    </div>
  );
}
