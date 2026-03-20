import Image from "next/image";

type Props = {
  /** Tailwind classes on the outer flex row */
  className?: string;
  /** Logo pixel size (square source asset) */
  size?: number;
  showWordmark?: boolean;
  wordmarkClassName?: string;
  priority?: boolean;
};

export default function BrandMark({
  className = "",
  size = 36,
  showWordmark = true,
  wordmarkClassName = "font-semibold text-lg tracking-tight",
  priority = false,
}: Props) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <Image
        src="/brand/logo.png"
        alt="LightLoft"
        width={size}
        height={size}
        className="object-contain shrink-0"
        priority={priority}
      />
      {showWordmark ? <span className={wordmarkClassName}>LightLoft</span> : null}
    </div>
  );
}
