import Async from "../../components/Async";
import Title from "../../components/Title";
import ProfileForm from "../../forms/ProfileForm";
import { useGet } from "../../hooks/useGet";

export default function Profile() {
  const q = useGet(["profile"], "/profile");
  return <div><Title>My profile</Title><Async q={q}>{(p) => <ProfileForm profile={p} />}</Async></div>;
}
