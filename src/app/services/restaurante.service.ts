import { Injectable, inject } from '@angular/core';
import { Firestore, collection, getDocs, addDoc, deleteDoc, doc, setDoc } from '@angular/fire/firestore';
import { Restaurante } from '../interface/restaurante';

@Injectable({ providedIn: 'root' })
export class RestauranteService {

  private firestore = inject(Firestore);
  private readonly COLECCION = 'restaurantesColeccion';

  // Obtiene todos los restaurantes de Firestore (incluye el id del documento)
  async getAll(): Promise<Restaurante[]> {
    const snapshot = await getDocs(collection(this.firestore, this.COLECCION));
    return snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Restaurante));
  }

  // Borra un único restaurante por su id de documento
  async delete(id: string): Promise<void> {
    await deleteDoc(doc(this.firestore, this.COLECCION, id));
  }

  // Borra todos los documentos de la colección
  async deleteAll(): Promise<void> {
    const snapshot = await getDocs(collection(this.firestore, this.COLECCION));
    await Promise.all(
      snapshot.docs.map(d => deleteDoc(doc(this.firestore, this.COLECCION, d.id)))
    );
  }

  // Añade un array de restaurantes a la colección
  async addAll(restaurantes: Restaurante[]): Promise<void> {
    const col = collection(this.firestore, this.COLECCION);
    for (const r of restaurantes) {
      await addDoc(col, r);
    }
  }

  // Añade un único restaurante a la colección
  async add(restaurante: Restaurante): Promise<void> {
    const col = collection(this.firestore, this.COLECCION);
    await addDoc(col, restaurante);
  }

  // CAMBIO: RESTAURA EL DOCUMENTO CON SU ID ORIGINAL PARA EVITAR DUPLICADOS.
  async restore(restaurante: Restaurante): Promise<void> {
    const { id, ...datos } = restaurante;
    if (!id) {
      throw new Error('No se puede restaurar un restaurante sin ID.');
    }
    await setDoc(doc(this.firestore, this.COLECCION, id), datos);
  }
}
