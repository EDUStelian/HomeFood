```jsx
import { useEffect, useRef, useState } from 'react'
import { BrowserMultiFormatReader } from '@zxing/browser'
import './App.css'

function App() {
  const videoRef = useRef(null)
  const controlsRef = useRef(null)

  const [scanning, setScanning] = useState(false)
  const [barcode, setBarcode] = useState('')
  const [product, setProduct] = useState(null)
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  // Load products from SQLite when the app starts
  useEffect(() => {
    fetch('http://127.0.0.1:8000/products')
      .then((response) => {
        if (!response.ok) {
          throw new Error('Could not load products')
        }

        return response.json()
      })
      .then((data) => {
        setProducts(data)
      })
      .catch((err) => {
        console.error('Could not load products:', err)
        setError('Could not connect to the HomeFood database.')
      })
  }, [])

  // Stop the camera
  const stopScanner = () => {
    if (controlsRef.current) {
      controlsRef.current.stop()
      controlsRef.current = null
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null
    }

    setScanning(false)
  }

  // Look up a barcode in Open Food Facts
  const findProduct = async (code) => {
    setLoading(true)
    setError('')
    setProduct(null)

    try {
      const url =
        'https://world.openfoodfacts.org/api/v2/product/' +
        code +
        '?fields=product_name,brands,quantity,image_front_url,categories'

      const response = await fetch(url)
      const data = await response.json()

      if (data.status === 1 && data.product) {
        setProduct({
          ...data.product,
          barcode: code,
        })
      } else {
        setError(
          'Product was not found in Open Food Facts.',
        )
      }
    } catch (err) {
      console.error('Open Food Facts error:', err)

      setError(
        'Could not connect to Open Food Facts.',
      )
    } finally {
      setLoading(false)
    }
  }

  // Start barcode scanner
  const startScanner = async () => {
    setBarcode('')
    setProduct(null)
    setError('')
    setScanning(true)

    try {
      const reader = new BrowserMultiFormatReader()

      const controls = await reader.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result) => {
          if (result) {
            const code = result.getText()

            setBarcode(code)

            if (controlsRef.current) {
              controlsRef.current.stop()
              controlsRef.current = null
            }

            if (videoRef.current) {
              videoRef.current.srcObject = null
            }

            setScanning(false)

            findProduct(code)
          }
        },
      )

      controlsRef.current = controls
    } catch (err) {
      console.error('Scanner error:', err)

      setError('Could not access the camera.')
      setScanning(false)
    }
  }

  // Add the Open Food Facts product to SQLite
  const addProduct = async () => {
    if (!product) return

    const newProduct = {
      barcode: product.barcode,
      name: product.product_name || 'Unknown product',
      brand: product.brands || '',
      quantity: product.quantity || '',
      image: product.image_front_url || '',
      category: product.categories || '',
    }

    try {
      const response = await fetch(
        'http://127.0.0.1:8000/products',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(newProduct),
        },
      )

      const data = await response.json()

      if (!data.success) {
        setError(
          data.message || 'Could not add product.',
        )
        return
      }

      setProducts((currentProducts) => [
        ...currentProducts,
        {
          ...newProduct,
          id: data.id,
        },
      ])

      setProduct(null)
      setBarcode('')
      setError('')
    } catch (err) {
      console.error('Could not save product:', err)

      setError(
        'Could not connect to the HomeFood database.',
      )
    }
  }

  // Remove product from the current screen
  const removeProduct = (id) => {
    setProducts((currentProducts) =>
      currentProducts.filter((item) => item.id !== id),
    )
  }

  // Stop scanner when leaving the page
  useEffect(() => {
    return () => {
      if (controlsRef.current) {
        controlsRef.current.stop()
      }
    }
  }, [])

  return (
    <div className="app">
      <header className="header">
        <h1>🏠 HomeFood</h1>
        <p>What's in my house?</p>
      </header>

      <main>
        <button
          className="scan-button"
          onClick={startScanner}
          disabled={scanning}
        >
          📷 Scan Product
        </button>

        <div
          className="scanner"
          style={{
            display: scanning ? 'block' : 'none',
          }}
        >
          <div className="camera-container">
            <video
              ref={videoRef}
              className="camera"
              autoPlay
              muted
              playsInline
            />

            <div className="scan-frame"></div>
          </div>

          <button
            className="stop-button"
            onClick={stopScanner}
          >
            ✕ Stop Scanner
          </button>
        </div>

        {!scanning && !barcode && !product && (
          <p className="scan-text">
            Use your webcam to scan a grocery barcode
          </p>
        )}

        {barcode && (
          <div className="result">
            <h2>Barcode detected! ✅</h2>
            <p>{barcode}</p>
          </div>
        )}

        {loading && (
          <div className="result">
            <h2>🔎 Looking up product...</h2>
            <p>Please wait.</p>
          </div>
        )}

        {product && (
          <div className="product">
            {product.image_front_url && (
              <img
                src={product.image_front_url}
                alt={
                  product.product_name || 'Product'
                }
                className="product-image"
              />
            )}

            <div className="product-info">
              <h2>
                {product.product_name ||
                  'Unknown product'}
              </h2>

              {product.brands && (
                <p>
                  <strong>Brand:</strong>{' '}
                  {product.brands}
                </p>
              )}

              {product.quantity && (
                <p>
                  <strong>Quantity:</strong>{' '}
                  {product.quantity}
                </p>
              )}

              <button
                className="add-button"
                onClick={addProduct}
              >
                ➕ Add to My Ingredients
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="error">
            {error}
          </div>
        )}

        <section className="ingredients">
          <h2>
            My Ingredients ({products.length})
          </h2>

          {products.length === 0 ? (
            <div className="empty">
              <div className="empty-icon">🛒</div>

              <p>No products yet</p>

              <span>
                Scan a product to add it to your
                home inventory.
              </span>
            </div>
          ) : (
            <div className="product-list">
              {products.map((item) => (
                <div
                  className="inventory-item"
                  key={item.id}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="inventory-image"
                    />
                  ) : (
                    <div className="inventory-placeholder">
                      🛒
                    </div>
                  )}

                  <div className="inventory-info">
                    <h3>{item.name}</h3>

                    {item.brand && (
                      <p>{item.brand}</p>
                    )}

                    {item.quantity && (
                      <span>{item.quantity}</span>
                    )}
                  </div>

                  <button
                    className="remove-button"
                    onClick={() =>
                      removeProduct(item.id)
                    }
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  )
}

export default App
```
