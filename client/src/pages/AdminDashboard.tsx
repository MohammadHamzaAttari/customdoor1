import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Settings, Save, AlertCircle, LogOut, Package, PoundSterling, Truck } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '@/hooks/use-auth';

interface SystemSetting {
  settingKey: string;
  settingValue: string;
}

export default function AdminDashboard() {
  const queryClient = useQueryClient();
  const { logoutMutation } = useAuth();
  const [editingValues, setEditingValues] = useState<Record<string, string>>({});

  const { data: settings, isLoading, error } = useQuery<SystemSetting[]>({
    queryKey: ['/api/settings'],
    queryFn: async () => {
      const res = await fetch('/api/settings');
      if (!res.ok) throw new Error('Failed to fetch settings');
      return res.json();
    },
  });

  const updateSetting = useMutation({
    mutationFn: async ({ settingKey, value }: { settingKey: string; value: string }) => {
      const res = await fetch(`/api/settings/${settingKey}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ value }),
      });
      if (!res.ok) throw new Error('Failed to update setting');
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/settings'] });
      toast.success('Settings updated successfully');
    },
    onError: (err) => {
      toast.error('Failed to update setting: ' + err.message);
    },
  });

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-stone-50">
        <Loader2 className="w-10 h-10 animate-spin text-orange-500" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen p-12 text-center text-red-500 flex flex-col items-center justify-center gap-4 bg-stone-50">
        <AlertCircle className="w-16 h-16" />
        <h2 className="text-2xl font-bold">Failed to load system settings</h2>
        <p className="text-sm">{(error as Error).message}</p>
      </div>
    );
  }

  const handleSave = (settingKey: string) => {
    if (editingValues[settingKey] !== undefined) {
      updateSetting.mutate({ settingKey, value: editingValues[settingKey] });
    }
  };

  const handleValueChange = (settingKey: string, value: string) => {
    setEditingValues(prev => ({ ...prev, [settingKey]: value }));
  };

  const getValue = (setting: SystemSetting) => {
    return editingValues[setting.settingKey] !== undefined ? editingValues[setting.settingKey] : setting.settingValue;
  };

  // Group settings for better presentation
  const manufacturingSettings = settings?.filter(s => 
    (s.settingKey.startsWith('PANEL_') || s.settingKey.startsWith('DXF_') || s.settingKey.includes('BORDER') || s.settingKey.includes('MM')) &&
    s.settingKey !== 'PANEL_THICKNESS_MM'
  ) || [];
  const basePricingSettings = settings?.filter(s => s.settingKey.includes('PRICE') || s.settingKey.includes('VAT') || s.settingKey.includes('FEE')) || [];
  const otherSettings = settings?.filter(s => !manufacturingSettings.includes(s) && !basePricingSettings.includes(s) && s.settingKey !== 'PANEL_THICKNESS_MM') || [];

  const SettingRow = ({ setting }: { setting: SystemSetting }) => (
    <div className="p-4 flex flex-col gap-2 transition-colors hover:bg-stone-50/50">
      <div className="flex justify-between items-start">
        <span className="text-xs font-bold text-stone-500 font-mono tracking-tighter uppercase">{setting.settingKey.replace(/_/g, ' ')}</span>
        {(editingValues[setting.settingKey] !== undefined && editingValues[setting.settingKey] !== setting.settingValue) && (
          <span className="text-[10px] font-black text-orange-500 animate-pulse">UNSAVED</span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <Input 
          className="font-mono text-sm h-10 bg-white border-stone-200" 
          value={getValue(setting)} 
          onChange={(e) => handleValueChange(setting.settingKey, e.target.value)}
        />
        <Button 
          size="sm" 
          variant={(editingValues[setting.settingKey] !== undefined && editingValues[setting.settingKey] !== setting.settingValue) ? "default" : "secondary"}
          className="h-10 px-4 shrink-0 shadow-sm"
          onClick={() => handleSave(setting.settingKey)}
          disabled={updateSetting.isPending || (editingValues[setting.settingKey] === undefined || editingValues[setting.settingKey] === setting.settingValue)}
        >
          <Save className="w-4 h-4 mr-2" />
          Save
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-stone-50/50">
      <header className="bg-white border-b border-stone-200 sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 h-20 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-orange-500 p-2.5 rounded-xl shadow-lg shadow-orange-200">
              <Settings className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-xl font-black text-stone-900 tracking-tight leading-none mb-1">Admin Dashboard</h1>
              <p className="text-stone-400 text-[11px] font-bold uppercase tracking-widest">System Management</p>
            </div>
          </div>
          
          <Button 
            variant="ghost" 
            className="text-stone-500 hover:text-red-600 hover:bg-red-50 font-bold transition-all"
            onClick={() => logoutMutation.mutate()}
            disabled={logoutMutation.isPending}
          >
            {logoutMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin mr-2" /> : <LogOut className="w-4 h-4 mr-2" />}
            Logout
          </Button>
        </div>
      </header>

      <main className="max-w-6xl mx-auto p-6 space-y-8">
        <Tabs defaultValue="manufacturing" className="space-y-6">
          <TabsList className="bg-stone-100 p-1 border border-stone-200 h-12">
            <TabsTrigger value="manufacturing" className="h-10 px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Package className="w-4 h-4 mr-2" />
              Manufacturing
            </TabsTrigger>
            <TabsTrigger value="pricing" className="h-10 px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <PoundSterling className="w-4 h-4 mr-2" />
              Pricing & VAT
            </TabsTrigger>
            <TabsTrigger value="other" className="h-10 px-6 font-bold data-[state=active]:bg-white data-[state=active]:shadow-sm">
              <Settings className="w-4 h-4 mr-2" />
              Other
            </TabsTrigger>
          </TabsList>

          <TabsContent value="manufacturing">
            <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-4">
                <CardTitle className="text-sm font-black text-stone-600 uppercase tracking-widest">Tolerances & DXF Layers</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2 divide-y divide-stone-100 md:divide-y-0 md:[&>*:nth-child(odd)]:border-r">
                  {manufacturingSettings.map((setting) => (
                    <SettingRow key={setting.settingKey} setting={setting} />
                  ))}
                  {manufacturingSettings.length === 0 && <div className="p-12 text-center text-sm text-stone-500 col-span-2">No manufacturing settings found.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="pricing">
            <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-4">
                <CardTitle className="text-sm font-black text-stone-600 uppercase tracking-widest">Base Fees & Rates</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2 divide-y divide-stone-100 md:divide-y-0 md:[&>*:nth-child(odd)]:border-r">
                  {basePricingSettings.map((setting) => (
                    <SettingRow key={setting.settingKey} setting={setting} />
                  ))}
                  {basePricingSettings.length === 0 && <div className="p-12 text-center text-sm text-stone-500 col-span-2">No pricing settings found.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="other">
            <Card className="border-stone-200 shadow-sm overflow-hidden bg-white">
              <CardHeader className="bg-stone-50/50 border-b border-stone-100 py-4">
                <CardTitle className="text-sm font-black text-stone-600 uppercase tracking-widest">Miscellaneous Configuration</CardTitle>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid md:grid-cols-2 divide-y divide-stone-100 md:divide-y-0 md:[&>*:nth-child(odd)]:border-r">
                  {otherSettings.map((setting) => (
                    <SettingRow key={setting.settingKey} setting={setting} />
                  ))}
                  {otherSettings.length === 0 && <div className="p-12 text-center text-sm text-stone-500 col-span-2">No other settings found.</div>}
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}
