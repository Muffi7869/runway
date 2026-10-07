-- Allow assignments to represent an absent spec and an estimate that has not been generated yet.

alter table public.assignments
  alter column spec_text drop not null;

alter table public.assignments
  alter column ai_total_estimate_minutes drop not null;

update public.assignments
set spec_text = null
where spec_text ~ '^\s*$';

alter table public.assignments
  add constraint assignments_spec_text_not_blank
    check (spec_text is null or spec_text !~ '^\s*$');

alter table public.assignments
  add constraint assignments_ai_total_estimate_nonneg
    check (
      ai_total_estimate_minutes is null
      or ai_total_estimate_minutes >= 0
    );
