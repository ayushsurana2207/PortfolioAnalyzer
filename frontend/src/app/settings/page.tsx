"use client";

import React, { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Sliders, 
  Mail, 
  HelpCircle, 
  Save, 
  Send, 
  Cpu,
  Loader2
} from "lucide-react";
import { toast } from "sonner";

import { apiService } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

export default function SettingsPage() {
  const queryClient = useQueryClient();

  // 1. Query all settings from database
  const { data: settings = {}, isLoading } = useQuery({
    queryKey: ["settings"],
    queryFn: () => apiService.getAppSettings(),
  });

  // Local Form States: Thresholds
  const [techConcentration, setTechConcentration] = useState("40");
  const [singleStock, setSingleStock] = useState("20");
  const [drawdown, setDrawdown] = useState("15");
  const [earningsDays, setEarningsDays] = useState("7");
  const [reviewDay, setReviewDay] = useState("1");

  // Local Form States: AI Model
  const [llmProvider, setLlmProvider] = useState("gemini");
  const [geminiKey, setGeminiKey] = useState("");
  const [openaiKey, setOpenaiKey] = useState("");
  const [anthropicKey, setAnthropicKey] = useState("");

  // Local Form States: SMTP
  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState("587");
  const [smtpUsername, setSmtpUsername] = useState("");
  const [smtpPassword, setSmtpPassword] = useState("");
  const [smtpSender, setSmtpSender] = useState("");
  const [recipientEmail, setRecipientEmail] = useState("");

  // Sync form state when database query finishes loading
  useEffect(() => {
    if (settings && Object.keys(settings).length > 0) {
      // Thresholds
      if (settings.tech_concentration_threshold) setTechConcentration(settings.tech_concentration_threshold);
      if (settings.single_stock_threshold) setSingleStock(settings.single_stock_threshold);
      if (settings.drawdown_alert_pct) setDrawdown(settings.drawdown_alert_pct);
      if (settings.earnings_warning_days) setEarningsDays(settings.earnings_warning_days);
      if (settings.monthly_review_day) setReviewDay(settings.monthly_review_day);

      // AI Settings
      if (settings.llm_provider) setLlmProvider(settings.llm_provider);
      if (settings.gemini_api_key) setGeminiKey(settings.gemini_api_key);
      if (settings.openai_api_key) setOpenaiKey(settings.openai_api_key);
      if (settings.anthropic_api_key) setAnthropicKey(settings.anthropic_api_key);

      // SMTP
      if (settings.smtp_host) setSmtpHost(settings.smtp_host);
      if (settings.smtp_port) setSmtpPort(settings.smtp_port);
      if (settings.smtp_username) setSmtpUsername(settings.smtp_username);
      if (settings.smtp_password) setSmtpPassword(settings.smtp_password);
      if (settings.smtp_sender) setSmtpSender(settings.smtp_sender);
      if (settings.alert_recipient_email) setRecipientEmail(settings.alert_recipient_email);
    }
  }, [settings]);

  // 2. Mutation to save batch settings to the database
  const saveSettingsMutation = useMutation({
    mutationFn: (newSettings: Record<string, string>) =>
      apiService.updateAppSettings(newSettings),
    onSuccess: (data) => {
      queryClient.setQueryData(["settings"], data);
      queryClient.invalidateQueries({ queryKey: ["summary"] }); // Refetch dashboard summary thresholds
      toast.success("Configurations updated successfully!");
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "Failed to update configurations.");
    },
  });

  // 3. Mutation to run SMTP connection diagnostic test email
  const testSmtpMutation = useMutation({
    mutationFn: () => apiService.testTelegramNotification(),
    onMutate: () => {
      toast.loading("Sending test email alert...", { id: "test-smtp" });
    },
    onSuccess: () => {
      toast.success("Diagnostic email sent successfully! Please check your inbox.", { id: "test-smtp" });
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.detail || "SMTP test failed. Check your credentials.", { id: "test-smtp", duration: 6000 });
    },
  });

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    
    // Quick numerical validations
    const tcVal = parseFloat(techConcentration);
    const ssVal = parseFloat(singleStock);
    const ddVal = parseFloat(drawdown);
    const rdVal = parseInt(reviewDay);
    
    if (tcVal <= 0 || tcVal > 100 || ssVal <= 0 || ssVal > 100 || ddVal <= 0 || ddVal > 100) {
      toast.error("Threshold percentages must be between 1% and 100%.");
      return;
    }
    
    if (rdVal < 1 || rdVal > 28) {
      toast.error("Monthly review day must be between 1 and 28 to prevent calendar boundary conflicts.");
      return;
    }

    // Validate that the active LLM has a key
    if (llmProvider === "gemini" && !geminiKey.trim()) {
      toast.error("Google Gemini is selected, but Gemini API Key is empty.");
      return;
    }
    if (llmProvider === "openai" && !openaiKey.trim()) {
      toast.error("OpenAI is selected, but OpenAI API Key is empty.");
      return;
    }
    if (llmProvider === "anthropic" && !anthropicKey.trim()) {
      toast.error("Anthropic Claude is selected, but Anthropic API Key is empty.");
      return;
    }

    const payload: Record<string, string> = {
      // Thresholds
      tech_concentration_threshold: techConcentration,
      single_stock_threshold: singleStock,
      drawdown_alert_pct: drawdown,
      earnings_warning_days: earningsDays,
      monthly_review_day: reviewDay,
      
      // AI Settings
      llm_provider: llmProvider,
      gemini_api_key: geminiKey.trim(),
      openai_api_key: openaiKey.trim(),
      anthropic_api_key: anthropicKey.trim(),

      // SMTP
      smtp_host: smtpHost.trim(),
      smtp_port: smtpPort.trim(),
      smtp_username: smtpUsername.trim(),
      smtp_password: smtpPassword, 
      smtp_sender: smtpSender.trim(),
      alert_recipient_email: recipientEmail.trim(),
    };

    saveSettingsMutation.mutate(payload);
  };

  if (isLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[40vh] animate-pulse text-slate-400 text-xs">
        <Loader2 className="animate-spin mb-2 text-indigo-600" size={24} />
        Loading settings console...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="space-y-1">
        <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
          System Settings
        </h1>
        <p className="text-xs text-slate-400 font-medium">
          Configure risk thresholds, pick your single active AI reasoning model, and link your secure SMTP email notification credentials.
        </p>
      </div>

      <form onSubmit={handleSaveSettings} className="space-y-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">
          
          {/* Column 1: Alert Thresholds & AI Model stacked */}
          <div className="space-y-6">
            {/* 1A. Alert Thresholds Card */}
            <Card className="border border-slate-100 shadow-[0_0_24px_rgba(0,0,0,0.008)] bg-white rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Sliders className="text-indigo-500" size={18} />
                  <h3 className="text-sm font-bold text-slate-700">Risk & Alert Thresholds</h3>
                </div>

                <div className="space-y-4">
                  {/* Tech Concentration */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label htmlFor="tc-threshold" className="text-xs font-bold text-slate-500">Tech Concentration Limit (%)</Label>
                      <span className="text-xs font-bold text-slate-700">{techConcentration}%</span>
                    </div>
                    <Input
                      id="tc-threshold"
                      type="number"
                      min="1"
                      max="100"
                      value={techConcentration}
                      onChange={(e) => setTechConcentration(e.target.value)}
                      className="rounded-xl h-9 text-xs border-slate-200"
                    />
                    <p className="text-[9px] text-slate-400 leading-normal">
                      Triggers a warning if your aggregate tech sector exposure (including weighted mutual funds) exceeds this value.
                    </p>
                  </div>

                  {/* Single stock threshold */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label htmlFor="ss-threshold" className="text-xs font-bold text-slate-500">Single Asset Cap (%)</Label>
                      <span className="text-xs font-bold text-slate-700">{singleStock}%</span>
                    </div>
                    <Input
                      id="ss-threshold"
                      type="number"
                      min="1"
                      max="100"
                      value={singleStock}
                      onChange={(e) => setSingleStock(e.target.value)}
                      className="rounded-xl h-9 text-xs border-slate-200"
                    />
                    <p className="text-[9px] text-slate-400 leading-normal">
                      Triggers an alert if any individual stock or vested RSU holding exceeds this percentage of your net worth.
                    </p>
                  </div>

                  {/* Drawdown Alert Percentage */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label htmlFor="dd-threshold" className="text-xs font-bold text-slate-500">Drawdown Warning Level (%)</Label>
                      <span className="text-xs font-bold text-slate-700">{drawdown}%</span>
                    </div>
                    <Input
                      id="dd-threshold"
                      type="number"
                      min="1"
                      max="100"
                      value={drawdown}
                      onChange={(e) => setDrawdown(e.target.value)}
                      className="rounded-xl h-9 text-xs border-slate-200"
                    />
                    <p className="text-[9px] text-slate-400 leading-normal">
                      Triggers an alert if an equity's price falls below this percentage from your average cost basis.
                    </p>
                  </div>

                  {/* Monthly Review Scheduler Day */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <Label htmlFor="review-day" className="text-xs font-bold text-slate-500">Monthly Review Day (1-28)</Label>
                      <span className="text-xs font-bold text-slate-700">Day {reviewDay}</span>
                    </div>
                    <Input
                      id="review-day"
                      type="number"
                      min="1"
                      max="28"
                      value={reviewDay}
                      onChange={(e) => setReviewDay(e.target.value)}
                      className="rounded-xl h-9 text-xs border-slate-200"
                    />
                    <p className="text-[9px] text-slate-400 leading-normal">
                      The calendar day of the month on which the background scheduler will run your monthly AI portfolio review.
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* 1B. AI Model Configuration Card */}
            <Card className="border border-slate-100 shadow-[0_0_24_rgba(0,0,0,0.008)] bg-white rounded-2xl overflow-hidden">
              <CardContent className="p-6 space-y-5">
                <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                  <Cpu className="text-indigo-500" size={18} />
                  <h3 className="text-sm font-bold text-slate-700">AI Model Configuration</h3>
                </div>

                <div className="space-y-4">
                  {/* Select Model Provider */}
                  <div className="space-y-1.5">
                    <Label htmlFor="llm-provider" className="text-xs font-bold text-slate-500">Active AI Model Provider</Label>
                    <select
                      id="llm-provider"
                      value={llmProvider}
                      onChange={(e) => setLlmProvider(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-slate-200 bg-white px-3 py-1 text-xs shadow-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="gemini">Google Gemini (Gemini 1.5 Pro)</option>
                      <option value="openai">OpenAI (GPT-4o)</option>
                      <option value="anthropic">Anthropic Claude (Claude 3.5 Sonnet)</option>
                    </select>
                    <p className="text-[9px] text-slate-400 leading-normal">
                      Select which single model is active. The agent will execute PDF parsing and monthly reviews using *only* this selected model.
                    </p>
                  </div>

                  {/* Gemini Key Input (Visible always but password masked) */}
                  <div className="space-y-1.5">
                    <Label htmlFor="gemini-key" className="text-xs font-bold text-slate-500">Google Gemini API Key</Label>
                    <Input
                      id="gemini-key"
                      type="password"
                      value={geminiKey}
                      onChange={(e) => setGeminiKey(e.target.value)}
                      placeholder={llmProvider === "gemini" ? "Enter Gemini API Key" : "Optional (Inactive)"}
                      className="rounded-xl h-8.5 text-xs border-slate-200"
                    />
                  </div>

                  {/* OpenAI Key Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="openai-key" className="text-xs font-bold text-slate-500">OpenAI API Key</Label>
                    <Input
                      id="openai-key"
                      type="password"
                      value={openaiKey}
                      onChange={(e) => setOpenaiKey(e.target.value)}
                      placeholder={llmProvider === "openai" ? "Enter OpenAI API Key" : "Optional (Inactive)"}
                      className="rounded-xl h-8.5 text-xs border-slate-200"
                    />
                  </div>

                  {/* Anthropic Key Input */}
                  <div className="space-y-1.5">
                    <Label htmlFor="anthropic-key" className="text-xs font-bold text-slate-500">Anthropic Claude API Key</Label>
                    <Input
                      id="anthropic-key"
                      type="password"
                      value={anthropicKey}
                      onChange={(e) => setAnthropicKey(e.target.value)}
                      placeholder={llmProvider === "anthropic" ? "Enter Claude API Key" : "Optional (Inactive)"}
                      className="rounded-xl h-8.5 text-xs border-slate-200"
                    />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Column 2: SMTP Email Configurations */}
          <Card className="border border-slate-100 shadow-[0_0_24_rgba(0,0,0,0.008)] bg-white rounded-2xl overflow-hidden">
            <CardContent className="p-6 space-y-5">
              <div className="flex items-center gap-2 border-b border-slate-100 pb-3">
                <Mail className="text-indigo-500" size={18} />
                <h3 className="text-sm font-bold text-slate-700">SMTP Email Alerts</h3>
              </div>

              {/* SMTP configuration instructions */}
              <Alert className="border border-indigo-100 bg-indigo-50/10 rounded-xl p-3">
                <HelpCircle className="h-4 w-4 text-indigo-600 shrink-0" />
                <div className="ml-1">
                  <AlertTitle className="text-[10px] font-bold tracking-tight text-slate-855">Gmail App Password Setup Guide</AlertTitle>
                  <AlertDescription className="text-[9px] text-slate-500 leading-normal mt-0.5">
                    1. Go to Google Account Settings &rarr; Security &rarr; 2-Step Verification.<br />
                    2. Scroll to the bottom and select <strong>App Passwords</strong>.<br />
                    3. Generate a password (select "Mail" and "Other (Custom Name)" e.g. PortfolioAgent).<br />
                    4. Copy the generated 16-character code and paste it into the password field below.<br />
                    5. Use host: <strong>smtp.gmail.com</strong> and port: <strong>587</strong>.
                  </AlertDescription>
                </div>
              </Alert>

              <div className="space-y-4">
                {/* SMTP Host & Port */}
                <div className="grid grid-cols-3 gap-4">
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor="smtp-host" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">SMTP Host</Label>
                    <Input
                      id="smtp-host"
                      type="text"
                      value={smtpHost}
                      onChange={(e) => setSmtpHost(e.target.value)}
                      placeholder="smtp.gmail.com"
                      className="rounded-xl h-8.5 text-xs border-slate-200"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="smtp-port" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">SMTP Port</Label>
                    <Input
                      id="smtp-port"
                      type="number"
                      value={smtpPort}
                      onChange={(e) => setSmtpPort(e.target.value)}
                      placeholder="587"
                      className="rounded-xl h-8.5 text-xs border-slate-200"
                    />
                  </div>
                </div>

                {/* SMTP Username */}
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-user" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">SMTP Username (Email)</Label>
                  <Input
                    id="smtp-user"
                    type="email"
                    value={smtpUsername}
                    onChange={(e) => setSmtpUsername(e.target.value)}
                    placeholder="your-email@gmail.com"
                    className="rounded-xl h-8.5 text-xs border-slate-200"
                  />
                </div>

                {/* SMTP Password */}
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-pass" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">SMTP Password (App Password)</Label>
                  <Input
                    id="smtp-pass"
                    type="password"
                    value={smtpPassword}
                    onChange={(e) => setSmtpPassword(e.target.value)}
                    placeholder="••••••••••••••••"
                    className="rounded-xl h-8.5 text-xs border-slate-200"
                  />
                </div>

                {/* SMTP Sender */}
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-sender" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Sender Email Address</Label>
                  <Input
                    id="smtp-sender"
                    type="email"
                    value={smtpSender}
                    onChange={(e) => setSmtpSender(e.target.value)}
                    placeholder="alerts@portfolio-agent.local"
                    className="rounded-xl h-8.5 text-xs border-slate-200"
                  />
                </div>

                {/* Recipient Email */}
                <div className="space-y-1.5">
                  <Label htmlFor="smtp-rec" className="text-[10px] font-bold text-slate-400 uppercase tracking-wide">Alert Recipient Email</Label>
                  <Input
                    id="smtp-rec"
                    type="email"
                    value={recipientEmail}
                    onChange={(e) => setRecipientEmail(e.target.value)}
                    placeholder="your-personal-email@gmail.com"
                    className="rounded-xl h-8.5 text-xs border-slate-200"
                  />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Form Action Controls at the bottom */}
        <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-slate-100 pt-6 mt-4 bg-white/50 p-4 rounded-2xl border">
          <p className="text-[10px] text-slate-400 font-medium max-w-sm">
            *Note: Active model and SMTP configurations will take effect instantly in real-time without requiring backend restarts.
          </p>
          <div className="flex items-center gap-3 self-stretch sm:self-auto">
            {/* SMTP Test Trigger */}
            <Button
              type="button"
              variant="outline"
              disabled={testSmtpMutation.isPending || saveSettingsMutation.isPending}
              onClick={() => testSmtpMutation.mutate()}
              className="flex-1 sm:flex-initial h-10 px-5 rounded-xl border-slate-200 hover:bg-slate-50 font-semibold text-xs text-slate-600 flex items-center justify-center gap-1.5 transition-all shadow-sm"
            >
              <Send size={13} />
              Send Test Email
            </Button>

            {/* Save batch configurations button */}
            <Button
              type="submit"
              disabled={saveSettingsMutation.isPending || testSmtpMutation.isPending}
              className="flex-1 sm:flex-initial h-10 px-6 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md shadow-indigo-100/30"
            >
              <Save size={13} />
              Save Configurations
            </Button>
          </div>
        </div>
      </form>
    </div>
  );
}
