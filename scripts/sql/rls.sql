alter table rooms enable row level security;
alter table room_members enable row level security;
alter table messages enable row level security;
alter table rolls enable row level security;
alter table presence enable row level security;

create policy if not exists rooms_select on rooms
  for select using (
    exists(select 1 from room_members rm where rm.room_id = rooms.id and rm.user_id = auth.uid())
    or rooms.owner = auth.uid()
  );

create policy if not exists rooms_insert on rooms
  for insert with check (owner = auth.uid());

create policy if not exists rooms_modify on rooms
  for update using (owner = auth.uid())
  with check (owner = auth.uid());

create policy if not exists rooms_delete on rooms
  for delete using (owner = auth.uid());

create policy if not exists room_members_select on room_members
  for select using (
    room_members.user_id = auth.uid() or
    exists(select 1 from rooms r where r.id = room_members.room_id and r.owner = auth.uid()) or
    exists(select 1 from room_members rm where rm.room_id = room_members.room_id and rm.user_id = auth.uid() and rm.role in ('OWNER','CO_GM'))
  );

create policy if not exists room_members_insert on room_members
  for insert with check (
    room_members.user_id = auth.uid() or
    exists(select 1 from rooms r where r.id = room_members.room_id and r.owner = auth.uid()) or
    exists(select 1 from room_members rm where rm.room_id = room_members.room_id and rm.user_id = auth.uid() and rm.role in ('OWNER','CO_GM'))
  );

create policy if not exists room_members_delete on room_members
  for delete using (
    room_members.user_id = auth.uid() or
    exists(select 1 from rooms r where r.id = room_members.room_id and r.owner = auth.uid()) or
    exists(select 1 from room_members rm where rm.room_id = room_members.room_id and rm.user_id = auth.uid() and rm.role in ('OWNER','CO_GM'))
  );

create policy if not exists messages_select on messages
  for select using (
    exists(select 1 from room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
  );

create policy if not exists messages_insert on messages
  for insert with check (
    exists(select 1 from room_members rm where rm.room_id = messages.room_id and rm.user_id = auth.uid())
  );

create policy if not exists rolls_select on rolls
  for select using (
    exists(select 1 from room_members rm where rm.room_id = rolls.room_id and rm.user_id = auth.uid())
  );

create policy if not exists rolls_insert on rolls
  for insert with check (
    exists(select 1 from room_members rm where rm.room_id = rolls.room_id and rm.user_id = auth.uid())
  );

create policy if not exists presence_select on presence
  for select using (
    exists(select 1 from room_members rm where rm.room_id = presence.room_id and rm.user_id = auth.uid())
  );

create policy if not exists presence_upsert on presence
  for insert with check (
    exists(select 1 from room_members rm where rm.room_id = presence.room_id and rm.user_id = auth.uid())
  );

create policy if not exists presence_update on presence
  for update using (
    exists(select 1 from room_members rm where rm.room_id = presence.room_id and rm.user_id = auth.uid())
  );
