set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  -- Chèn một hàng mới vào public.profiles
INSERT INTO public.profiles (id, email, full_name, phone_number, role)
  VALUES (
    new.id, 
    new.email, 
    new.raw_user_meta_data ->> 'contactName', 
    new.raw_user_meta_data ->> 'phone',       -- Lấy phone từ metadata
    new.raw_user_meta_data ->> 'role'         -- Lấy role từ metadata
  );
  RETURN new;
END;
$function$
;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();


