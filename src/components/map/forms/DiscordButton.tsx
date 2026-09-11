// "Add to your Discord account" (§4.4 step 6): v1 cannot complete a sign-in, so the button says
// what it does; disabled with a helper when the instance has no Discord app.
import { Button, ButtonLink } from "@/components/ui/button";
import { DiscordIcon } from "@/components/ui/icons";
import { discordInstallUrl } from "@/config/site";

export function DiscordButton() {
  const url = discordInstallUrl("account");
  return (
    <div>
      {url ? (
        <ButtonLink href={url} variant="discord" size="lg" className="w-full gap-2">
          <DiscordIcon size={18} />
          Add to your Discord account
        </ButtonLink>
      ) : (
        <Button variant="discord" size="lg" disabled className="w-full gap-2">
          <DiscordIcon size={18} />
          Add to your Discord account
        </Button>
      )}
      <p className="mt-2 text-sm text-fg-muted">
        {url
          ? "Adds the app to your account so it shows under Start an Activity. Sign-in comes later; you continue with a callsign."
          : "Discord is not configured on this instance."}
      </p>
    </div>
  );
}
