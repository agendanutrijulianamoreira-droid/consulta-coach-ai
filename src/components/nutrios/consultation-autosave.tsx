import { useEffect, useRef } from "react";
import type { AnthroData, SkinfoldFormula } from "@/modules/avaliacao/domain/anthropometry";
import type { EnergyInputs } from "@/modules/avaliacao/domain/energy";
import type { AnamnesisFields, MealPlan } from "@/lib/nutrios/types";
import * as db from "@/lib/nutrios/repository";

type Props = {
  consultationId: string;
  loaded: boolean;
  anamnesis: AnamnesisFields;
  anthro: AnthroData;
  formula: SkinfoldFormula;
  interpretation: string;
  energy: EnergyInputs;
  conduct: db.ConductRow;
  plan: { plan: MealPlan; rationale: string } | null;
};

type Snapshot = Omit<Props, "loaded">;

export function ConsultationAutosave(props: Props) {
  const latest = useRef<Snapshot>({
    consultationId: props.consultationId,
    anamnesis: props.anamnesis,
    anthro: props.anthro,
    formula: props.formula,
    interpretation: props.interpretation,
    energy: props.energy,
    conduct: props.conduct,
    plan: props.plan,
  });
  const timers = useRef<number[]>([]);

  latest.current = {
    consultationId: props.consultationId,
    anamnesis: props.anamnesis,
    anthro: props.anthro,
    formula: props.formula,
    interpretation: props.interpretation,
    energy: props.energy,
    conduct: props.conduct,
    plan: props.plan,
  };

  const schedule = (action: () => Promise<void>, delay: number) => {
    const timer = window.setTimeout(() => void action(), delay);
    timers.current.push(timer);
    return () => {
      window.clearTimeout(timer);
      timers.current = timers.current.filter((item) => item !== timer);
    };
  };

  useEffect(() => {
    if (!props.loaded) return;
    const snapshot = latest.current;
    return schedule(() => db.saveAnamnesis(snapshot.consultationId, snapshot.anamnesis), 450);
  }, [props.anamnesis, props.consultationId, props.loaded]);

  useEffect(() => {
    if (!props.loaded) return;
    const snapshot = latest.current;
    return schedule(
      () => db.saveAnthropometry(snapshot.consultationId, { ...snapshot.anthro, formula: snapshot.formula }, snapshot.interpretation),
      450,
    );
  }, [props.anthro, props.formula, props.interpretation, props.consultationId, props.loaded]);

  useEffect(() => {
    if (!props.loaded) return;
    const snapshot = latest.current;
    return schedule(
      () => db.saveConduct(snapshot.consultationId, {
        ...snapshot.conduct,
        energy: snapshot.energy as unknown as Record<string, unknown>,
      }),
      500,
    );
  }, [props.energy, props.conduct, props.consultationId, props.loaded]);

  useEffect(() => {
    if (!props.loaded || !props.plan) return;
    const snapshot = latest.current;
    return schedule(
      async () => {
        if (snapshot.plan) await db.saveMealPlan(snapshot.consultationId, snapshot.plan.plan, snapshot.plan.rationale);
      },
      700,
    );
  }, [props.plan, props.consultationId, props.loaded]);

  useEffect(() => () => {
    for (const timer of timers.current) window.clearTimeout(timer);
    const snapshot = latest.current;
    void Promise.all([
      db.saveAnamnesis(snapshot.consultationId, snapshot.anamnesis),
      db.saveAnthropometry(snapshot.consultationId, { ...snapshot.anthro, formula: snapshot.formula }, snapshot.interpretation),
      db.saveConduct(snapshot.consultationId, {
        ...snapshot.conduct,
        energy: snapshot.energy as unknown as Record<string, unknown>,
      }),
      snapshot.plan ? db.saveMealPlan(snapshot.consultationId, snapshot.plan.plan, snapshot.plan.rationale) : Promise.resolve(),
    ]);
  }, [props.consultationId]);

  return null;
}
