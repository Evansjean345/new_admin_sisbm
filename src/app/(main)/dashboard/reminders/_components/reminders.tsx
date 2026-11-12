"use client";

import { useState } from "react";

import { FlaskConical } from "lucide-react";

import { PageHeader } from "@/components/page-header";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

import { OverdueInvoices } from "./overdue-invoices";
import { ReminderHistory } from "./reminder-history";

export function Reminders() {
  const [tab, setTab] = useState("overdue");

  return (
    <div className="flex flex-col gap-4">
      <PageHeader
        title="Relances"
        description="Factures échues à relancer et historique des relances envoyées. Trois niveaux : rappel amiable, relance, mise en demeure."
      />

      <Alert>
        <FlaskConical />
        <AlertTitle>Données de démonstration</AlertTitle>
        <AlertDescription>
          Aucun e-mail ni SMS n'est réellement envoyé : les relances sont simulées en attendant l'API de facturation et
          la passerelle SMS.
        </AlertDescription>
      </Alert>

      <Tabs value={tab} onValueChange={setTab} className="gap-4">
        <TabsList>
          <TabsTrigger value="overdue">À relancer</TabsTrigger>
          <TabsTrigger value="history">Historique</TabsTrigger>
        </TabsList>
        <TabsContent value="overdue">
          <OverdueInvoices />
        </TabsContent>
        <TabsContent value="history">
          <ReminderHistory />
        </TabsContent>
      </Tabs>
    </div>
  );
}
