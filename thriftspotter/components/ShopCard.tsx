import Link from "next/link";
import type { Shop } from "@/lib/types";
import { formatPhone, slugify } from "@/lib/utils";

interface Props {
  shop: Shop;
  stateSlug: string;
  citySlug: string;
}

export default function ShopCard({ shop, stateSlug, citySlug }: Props) {
  return (
    <Link
      href={`/${stateSlug}/${citySlug}/${shop.slug}`}
      className="block border border-gray-200 rounded-xl p-5 hover:border-emerald-500 hover:shadow-md transition group"
    >
      <div className="flex items-start justify-between gap-2">
        <h3 className="font-semibold text-lg group-hover:text-emerald-700 leading-tight">
          {shop.name}
        </h3>
        {shop.rating && (
          <span className="text-sm text-gray-500 whitespace-nowrap">
            ★ {shop.rating.toFixed(1)}
            {shop.reviewCount && (
              <span className="text-gray-400"> ({shop.reviewCount})</span>
            )}
          </span>
        )}
      </div>
      <p className="text-gray-500 text-sm mt-1">{shop.address}</p>
      {shop.phone && (
        <p className="text-gray-500 text-sm mt-1">{formatPhone(shop.phone)}</p>
      )}
      {shop.categories.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-3">
          {shop.categories.slice(0, 3).map((cat) => (
            <span
              key={cat}
              className="text-xs bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full"
            >
              {cat}
            </span>
          ))}
        </div>
      )}
    </Link>
  );
}
