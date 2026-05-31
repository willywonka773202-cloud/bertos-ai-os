export const STYLUSLY_REBUILD_MAX_PROMPT = `We need to fix Stylusly. The last version moved in a good direction by using the cleaner Fits-style layout and greeting/onboarding style, but it removed too much of what made Stylusly useful. Right now the site is not usable because the clothing database is showing almost no clothes, the Tinder-like swipe feature is gone, and most of the old Stylusly functionality has been stripped out.

Do not rebuild Stylusly as a minimal Fits clone. Use the Fits app layout and edit flow as the structural foundation, but restore the full Stylusly product experience, data, wardrobe features, swipe discovery, outfit creation, and personality from the old app.

Main goal

Create a complete, usable Stylusly app that combines:

1. The clean Fits-style layout
- modern app shell
- clear navigation
- editable outfit canvas
- clothing tray/grid
- easy outfit editing
- smooth save/edit/shuffle/regenerate flow

2. The old Stylusly functionality
- full clothing database
- Tinder-like swipe discovery
- rich browsing/filtering
- outfit generation
- wardrobe/closet management
- saved outfits
- liked/disliked items
- style personalization
- useful clothing cards and item details

3. Stylusly's personality
- playful, fashionable, high-energy
- not sterile
- not generic
- keep the "say hi" / welcoming feeling, but do not remove actual functionality

Critical fixes

1. Restore all clothes

The current app is only showing a tiny number of clothing items. This must be fixed.

Audit the database and frontend queries so that all clothing items are visible and usable again.

Requirements:
- Do not wipe or replace the clothing database.
- Do not show only sample clothes.
- Do not limit the clothing catalog to a tiny subset.
- Do not accidentally filter out most clothing items.
- Check all category filters, gender filters, style filters, search filters, pagination, authentication restrictions, and database query limits.
- Make sure the default view shows a healthy, full clothing catalog.
- If there is pagination or infinite scroll, make it actually load more clothes.
- The app should be able to display tops, bottoms, shoes, outerwear, dresses, accessories, bags, jewelry, and other stored clothing categories.
- Any old clothing data from the previous Stylusly app should be connected back into the current UI.
- If seed/sample data is needed, restore a large, diverse clothing dataset instead of only a few items.

Acceptance test:
- A user should open the closet/catalog and see many clothing options, not just a few.
- A user should be able to filter by category and still see meaningful results.
- The outfit generator and swipe feature should pull from the full clothing dataset.

2. Bring back the Tinder-like feature

Restore the old Stylusly swipe experience. This is a core feature.

Create a dedicated Swipe / Discover section where users can swipe through clothing items and style options.

Requirements:
- Show one clothing item card at a time.
- Allow users to swipe or tap Like, Dislike, Super like / favorite if available, and Skip.
- Include clear buttons for desktop users, not only mobile gestures.
- Liked items should be saved to the user's liked clothing list.
- Disliked items should be remembered and not constantly shown again.
- Favorites should be available later when building outfits.
- The swipe card should show clothing image, item name, category, style tags, color, brand/source if available, price if available, and quick "add to outfit" or "save" action.
- Add animations so it feels alive and fun.
- Keep the experience fast and visual.

The swipe feature should feed into the rest of the app:
- Liked clothing should influence outfit recommendations.
- Liked clothing should be easy to add to outfits.
- Saved/favorited items should appear in the closet.
- Disliked items should be de-prioritized.

Acceptance test:
- A user can swipe through a large clothing catalog.
- Likes and dislikes persist.
- Liked items can be used in outfit creation.
- The feature feels like Stylusly, not a static product grid.

3. Keep the Fits-style layout and edit flow

The Fits-style layout worked well and should remain the base structure. The user should be able to create and edit outfits easily.

Use this layout direction:
- Main dashboard with a friendly greeting.
- Large central outfit area/canvas.
- Side or bottom clothing panel with searchable/filterable clothes.
- Outfit cards that can be edited.
- Clear actions: Generate outfit, Shuffle, Edit, Save, Favorite, Remove item, Replace item, Add item.
- Smooth transitions between browsing clothes, swiping clothes, and editing outfits.

Important: copying the Fits layout should not mean deleting Stylusly features. Fits provides the structure; Stylusly provides the product depth.

Acceptance test:
- A user can generate an outfit and then edit it.
- A user can replace just the shoes, just the top, just the accessories, etc.
- A user can manually add clothing from the full catalog.
- A user can save the outfit.
- A user can return to saved outfits later.

Required pages / sections

Home / Dashboard:
- Friendly greeting like "Hi, ready to style something?"
- Quick actions: Build an outfit, Swipe clothes, Browse closet, View saved outfits.
- Featured outfit or recommendation.
- Recently liked items.
- Recently saved outfits.
- Style inspiration area.
- The dashboard should feel alive, not empty.

Closet / Clothing Catalog:
- Full clothing grid.
- Search.
- Category filters.
- Color filters.
- Style filters.
- Occasion filters.
- Brand/source filter if available.
- Sort options.
- Item cards with images.
- Quick actions: Like, Favorite, Add to outfit, View details.
- Make sure it pulls from the full database.

Swipe / Discover:
- Large swipeable card.
- Like/dislike/favorite/skip actions.
- Item details.
- Smooth animations.
- Progress through the clothing catalog.
- Empty state only when the user has genuinely gone through all available items.
- Ability to reset or change filters.
- Do not show "no more clothes" if the database still has items.

Outfit Builder:
- Main outfit canvas.
- Clothing slots: top, bottom, shoes, outerwear, dress / one-piece when relevant, accessories, bag, jewelry.
- Add, remove, replace, and reorder where appropriate.
- Generate full outfit.
- Generate around a selected item.
- Shuffle one item.
- Shuffle entire outfit.
- Save outfit.
- Name outfit.
- Add tags/occasion.
- Edit saved outfits.
- The user should be able to build manually or with recommendations.

Saved Outfits:
- Outfit cards.
- Outfit image/preview.
- Outfit name.
- Occasion/style tags.
- Edit button.
- Duplicate/remix button.
- Delete button.
- Favorite button.
- Saved outfits should persist and should not be fake static cards.

Item Detail Page / Modal:
- Large image.
- Name.
- Category.
- Color.
- Tags.
- Brand/source.
- Price/link if available.
- Like/favorite status.
- Add to outfit.
- Find similar.
- Generate outfit with this item.

Old Stylusly features to restore or preserve:
- Full wardrobe/clothing database.
- Swipe-based clothing discovery.
- Liked clothing.
- Disliked clothing.
- Favorites.
- Saved outfits.
- Outfit generation.
- Outfit editing.
- Clothing search.
- Clothing filters.
- Clothing categories.
- Style tags.
- Occasion-based styling.
- Ability to generate outfits around a selected item.
- Ability to replace individual outfit pieces.
- Useful empty states.
- Mobile-friendly interface.
- Fun fashion-forward visual identity.

Do not remove features just because they are not present in Fits. Fits is only the layout/editing inspiration.

Data and database requirements

The biggest current issue is that almost no clothes appear. Fix this at the data/query layer, not just the UI.

Please inspect:
- database tables for clothing/items/products/wardrobe entries
- frontend queries
- API endpoints
- authentication or user-specific filters
- category filters
- default filters
- pagination limits
- row-level security or permissions if applicable
- hardcoded demo arrays replacing real data
- migrations that accidentally removed old clothes
- conditions like limit(6), isFeatured, isActive, userId, gender, style, or category filters hiding most data

The app should use real clothing data wherever available. Do not hide most items behind overly strict filters.

If there are user-owned closet items and global clothing catalog items, support both:
- My Closet: user's saved/owned/liked clothing
- Explore Catalog: all available clothing from the database

Visual direction

Keep Stylusly stylish, playful, and modern.

Style direction:
- fashion-app feel
- polished but fun
- not sterile
- bold cards
- smooth animations
- image-forward layout
- clean spacing
- mobile-friendly
- clear hierarchy
- warm greeting copy
- playful microcopy

Do not make it bland. The previous version took the life out of Stylusly. Restore the personality.

Example copy direction:
- "Hi, ready to build a fit?"
- "Swipe your way to your next outfit."
- "Start with a piece you love."
- "Want to remix this?"
- "Your liked pieces are ready to style."

UX rules:
- A new user should immediately understand what to do.
- No page should look empty if there is clothing data available.
- Do not use fake disabled buttons.
- Do not create dead-end flows.
- Every clothing card should have a useful action.
- Every generated outfit should be editable.
- Every liked item should be retrievable.
- Every saved outfit should persist.
- Use loading states and empty states, but do not mistake broken queries for empty states.

Mobile requirements:
- Swipe cards should be optimized for phone screens.
- Clothing catalog should be scrollable and filterable.
- Outfit builder should be easy to edit on mobile.
- Buttons should be large enough to tap.
- The layout should not require tiny drag-and-drop interactions only.
- Provide tap-based alternatives for editing and replacing outfit pieces.

Specific acceptance checklist:
- The app shows a large clothing catalog again.
- The database is not reduced to only a few clothes.
- Clothing filters work without accidentally hiding everything.
- The Tinder-like swipe feature is restored.
- Swipe likes/dislikes/favorites persist.
- Liked clothing can be used in outfit creation.
- Fits-style outfit editing layout is preserved.
- Users can generate outfits.
- Users can edit generated outfits.
- Users can replace individual clothing items.
- Users can browse all clothes.
- Users can save outfits.
- Users can view saved outfits.
- Users can generate an outfit around a selected item.
- The app has Stylusly personality and energy.
- The UI is not a generic clone of Fits.
- The site is usable by a real user from start to finish.

Final instruction:

Do a full pass on Stylusly as a real product, not a demo. The current version is too stripped down and almost unusable because most clothes are missing and the swipe feature is gone.

Keep what worked from Fits: the clean layout, editing flow, and easy outfit controls.

Restore what made Stylusly useful: the full clothing database, swipe discovery, outfit generation, closet browsing, saved outfits, favorites, likes/dislikes, filters, and fun styling personality.

Do not remove functionality. Do not hide most clothes. Do not leave the app as a static shell. The goal is a complete, lively, usable fashion styling app.`

export const STYLUSLY_REBUILD_PROMPT_TITLE = 'Stylusly Max Rebuild'
