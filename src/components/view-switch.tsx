import Link from "next/link";

type ViewSwitchItem = {
  href: string;
  label: string;
  active?: boolean;
};

type ViewSwitchProps = {
  items: ViewSwitchItem[];
};

export function ViewSwitch({ items }: ViewSwitchProps) {
  return (
    <div className="segmented-control">
      {items.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          aria-current={item.active ? "page" : undefined}
          className="segment-item"
          data-active={item.active ? "true" : "false"}
        >
          {item.label}
        </Link>
      ))}
    </div>
  );
}
