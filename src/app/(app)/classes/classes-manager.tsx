"use client";

import { useActionState, useEffect, useRef, useState } from "react";

import { ClassChip } from "../../../components/ui/class-chip";
import { CLASS_COLOR_PALETTE, type ClassColor } from "../../../lib/classes/palette";
import { describePace } from "../../../lib/pace/compute";

import { addClass, updateClass, type ClassActionState } from "./actions";
import styles from "./classes.module.css";

type ClassRow = {
  id: string; name: string; color: string; pace_ratio: number;
  stats: { activeAssignments: number; loggedTime: string; nextDue: string };
};

export function shouldCloseColorPopover(key: string): boolean { return key === "Escape"; }

function validColor(value: string): ClassColor | undefined {
  return CLASS_COLOR_PALETTE.find(({ key }) => key === value)?.key;
}

export function ColorPopover({ name, selectedColor, onChange, initialOpen = false }: {
  name: string; selectedColor: string; onChange: (color: ClassColor) => void; initialOpen?: boolean;
}) {
  const [open, setOpen] = useState(initialOpen);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const selected = validColor(selectedColor);
  const selectedLabel = CLASS_COLOR_PALETTE.find(({ key }) => key === selected)?.label;

  useEffect(() => {
    if (!open) return;
    function outside(event: PointerEvent) {
      if (!wrapperRef.current?.contains(event.target as Node)) {
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    function keydown(event: KeyboardEvent) {
      if (shouldCloseColorPopover(event.key)) {
        event.preventDefault();
        setOpen(false);
        buttonRef.current?.focus();
      }
    }
    document.addEventListener("pointerdown", outside);
    document.addEventListener("keydown", keydown);
    return () => { document.removeEventListener("pointerdown", outside); document.removeEventListener("keydown", keydown); };
  }, [open]);

  return <div className={styles.picker} ref={wrapperRef}>
    <input name={name} type="hidden" value={selectedColor} />
    <button aria-expanded={open} aria-haspopup="dialog" className={`ui-button ${styles.pickerButton}`} onClick={() => setOpen((value) => !value)} ref={buttonRef} type="button">
      <span>{selected ? <i aria-hidden="true" className={styles.pickerDot} data-class-color={selected} /> : null}{selectedLabel ?? "Choose color"}</span>
    </button>
    {open ? <div aria-label="Choose a class color" className={styles.popover} role="dialog">
      <div className={styles.palette} role="radiogroup">
        {CLASS_COLOR_PALETTE.map((color) => <button
          aria-checked={selectedColor === color.key} aria-label={color.label} className={styles.colorOption}
          data-class-color={color.key} key={color.key} onClick={() => { onChange(color.key); setOpen(false); buttonRef.current?.focus(); }} role="radio" type="button"
        ><span aria-hidden="true" /></button>)}
      </div>
    </div> : null}
  </div>;
}

function ActionMessage({ state }: { state: ClassActionState }) {
  if (state.error) return <p className={`${styles.message} ${styles.error}`}>{state.error}</p>;
  if (state.successMessage) return <p className={`${styles.message} ${styles.success}`}>{state.successMessage}</p>;
  return null;
}

function AddClassForm() {
  const [name, setName] = useState("");
  const [color, setColor] = useState<ClassColor | "">("");
  const [state, formAction, pending] = useActionState(async (previous: ClassActionState, data: FormData) => {
    const result = await addClass(previous, data);
    if (result.successMessage) { setName(""); setColor(""); }
    return result;
  }, {});
  return <form action={formAction} className={`ui-card ${styles.addCard}`}>
    <label className={styles.field}><span>Add a class</span><input className={styles.input} name="name" onChange={(event) => setName(event.target.value)} placeholder="Class name" value={name} /></label>
    <ColorPopover name="color" onChange={setColor} selectedColor={color} />
    <button className="ui-button ui-button--primary" disabled={pending} type="submit">{pending ? "Adding…" : "Add class"}</button>
    <ActionMessage state={state} />
  </form>;
}

function ExistingClassForm({ classRow }: { classRow: ClassRow }) {
  const [name, setName] = useState(classRow.name);
  const [color, setColor] = useState<ClassColor>(validColor(classRow.color) ?? "blue");
  const [state, formAction, pending] = useActionState(updateClass, {});
  return <form action={formAction} className={`ui-card ${styles.classCard}`}>
    <input name="class_id" type="hidden" value={classRow.id} />
    <div className={styles.classHeader}>
      <div><ClassChip color={color}>{classRow.name}</ClassChip><p className={styles.pace}>{describePace(Number(classRow.pace_ratio))}</p></div>
      <ColorPopover name="color" onChange={setColor} selectedColor={color} />
    </div>
    <dl className={styles.stats}>
      <div className={styles.stat}><dt>Active</dt><dd className="num">{classRow.stats.activeAssignments}</dd></div>
      <div className={styles.stat}><dt>Logged</dt><dd>{classRow.stats.loggedTime}</dd></div>
      <div className={styles.stat}><dt>Next due</dt><dd title={classRow.stats.nextDue}>{classRow.stats.nextDue}</dd></div>
    </dl>
    <div className={styles.editRow}>
      <label className={styles.field}><span>Rename</span><input className={styles.input} name="name" onChange={(event) => setName(event.target.value)} value={name} /></label>
      <button className="ui-button" disabled={pending} type="submit">{pending ? "Saving…" : "Save changes"}</button>
    </div>
    <ActionMessage state={state} />
  </form>;
}

export function ClassesManager({ classes }: { classes: ClassRow[] }) {
  return <><AddClassForm /><section aria-labelledby="saved-classes"><h2 className={styles.sectionHeading} id="saved-classes">Your classes</h2>
    {classes.length ? <div className={styles.grid}>{classes.map((row) => <ExistingClassForm classRow={row} key={row.id} />)}</div> : <p className={styles.empty}>No classes added yet.</p>}
  </section></>;
}
