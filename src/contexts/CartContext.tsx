import React, { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface CartItem {
  id: string;
  item_type: 'beat' | 'beat_pack';
  item_id: string;
  quantity: number;
  price_cents: number;
  title: string;
  image_url?: string;
  producer_name?: string;
}

interface CartContextType {
  items: CartItem[];
  addToCart: (item: Omit<CartItem, 'id'>) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  clearCart: () => Promise<void>;
  totalItems: number;
  totalPrice: number;
  isLoading: boolean;
}

const CartContext = createContext<CartContextType | undefined>(undefined);

export const useCart = () => {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};

export const CartProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const { toast } = useToast();

  const loadCart = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user.id);

      if (error) throw error;

      // Transform cart items to include additional info
      const cartItems: CartItem[] = [];
      for (const item of data || []) {
        let title = '';
        let image_url = '';
        let producer_name = '';

        if (item.item_type === 'beat') {
          const { data: beat } = await supabase
            .from('beats')
            .select('title, artwork_url, producer:profiles!beats_producer_id_fkey(producer_name)')
            .eq('id', item.item_id)
            .single();
          
          if (beat) {
            title = beat.title;
            image_url = beat.artwork_url;
            const producer = Array.isArray(beat.producer) ? beat.producer[0] : beat.producer;
            producer_name = producer?.producer_name || '';
          }
        } else {
          const { data: pack } = await supabase
            .from('beat_packs')
            .select('name, artwork_url, user:profiles!beat_packs_user_id_fkey(producer_name)')
            .eq('id', item.item_id)
            .single();
          
          if (pack) {
            title = pack.name;
            image_url = pack.artwork_url;
            const user = Array.isArray(pack.user) ? pack.user[0] : pack.user;
            producer_name = user?.producer_name || '';
          }
        }

        cartItems.push({
          id: item.id,
          item_type: item.item_type,
          item_id: item.item_id,
          quantity: item.quantity,
          price_cents: item.price_cents,
          title,
          image_url,
          producer_name
        });
      }

      setItems(cartItems);
    } catch (error) {
      console.error('Error loading cart:', error);
    }
  };

  const addToCart = async (item: Omit<CartItem, 'id'>) => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast({
          title: "Please log in",
          description: "You need to log in to add items to cart",
          variant: "destructive"
        });
        return;
      }

      // First check if item already exists
      const { data: existingItems } = await supabase
        .from('cart_items')
        .select('*')
        .eq('user_id', user.id)
        .eq('item_type', item.item_type)
        .eq('item_id', item.item_id)
        .maybeSingle();

      if (existingItems) {
        // Update quantity if item exists
        const { error } = await supabase
          .from('cart_items')
          .update({ 
            quantity: existingItems.quantity + item.quantity,
            price_cents: item.price_cents // Update price in case it changed
          })
          .eq('id', existingItems.id);

        if (error) throw error;
        
        toast({
          title: "Updated cart",
          description: `${item.title} quantity updated in your cart`
        });
      } else {
        // Insert new item
        const { error } = await supabase
          .from('cart_items')
          .insert({
            user_id: user.id,
            item_type: item.item_type,
            item_id: item.item_id,
            quantity: item.quantity,
            price_cents: item.price_cents
          });

        if (error) throw error;
        
        toast({
          title: "Added to cart",
          description: `${item.title} has been added to your cart`
        });
      }

      await loadCart();
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast({
        title: "Error",
        description: "Failed to add item to cart",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const removeFromCart = async (itemId: string) => {
    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId);

      if (error) throw error;
      await loadCart();
    } catch (error) {
      console.error('Error removing from cart:', error);
      toast({
        title: "Error",
        description: "Failed to remove item from cart",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (quantity <= 0) {
      await removeFromCart(itemId);
      return;
    }

    try {
      setIsLoading(true);
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId);

      if (error) throw error;
      await loadCart();
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast({
        title: "Error",
        description: "Failed to update quantity",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const clearCart = async () => {
    try {
      setIsLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id);

      if (error) throw error;
      setItems([]);
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast({
        title: "Error",
        description: "Failed to clear cart",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const totalItems = items.reduce((sum, item) => sum + item.quantity, 0);
  const totalPrice = items.reduce((sum, item) => sum + (item.price_cents * item.quantity), 0);

  useEffect(() => {
    loadCart();
  }, []);

  return (
    <CartContext.Provider value={{
      items,
      addToCart,
      removeFromCart,
      updateQuantity,
      clearCart,
      totalItems,
      totalPrice,
      isLoading
    }}>
      {children}
    </CartContext.Provider>
  );
};